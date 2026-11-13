from dataclasses import dataclass, field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.embeddings.provider import expand_synonyms, get_embedding_provider, tokenize_text
from app.models.entities import Scholarship
from app.rag.vector_store import _collection_names, _get_or_create_collection, get_chroma_client


COURSE_ALIASES: dict[str, set[str]] = {
    "b.tech": {"b.tech", "btech", "b.e.", "be", "engineering", "technical degree", "professional courses", "cse", "ai&ml", "all"},
    "b.e.": {"b.tech", "btech", "b.e.", "be", "engineering", "technical degree", "professional courses", "all"},
    "cse": {"b.tech", "btech", "b.e.", "engineering", "technical degree", "cse", "ai&ml", "all"},
    "ai&ml": {"b.tech", "btech", "b.e.", "engineering", "technical degree", "cse", "ai&ml", "all"},
    "engineering": {"b.tech", "btech", "b.e.", "engineering", "technical degree", "professional courses", "all"},
    "diploma": {"diploma", "technical diploma", "polytechnic", "all"},
    "m.tech": {"m.tech", "mtech", "engineering", "pg", "professional courses", "all"},
}


@dataclass
class SearchFilters:
    type: str | None = None
    basis: str | None = None
    education_level: str | None = None
    course: str | None = None
    state: str | None = None
    category: str | None = None
    max_income: float | None = None
    source_status: str | None = None
    gender: str | None = None


@dataclass
class RetrievedScholarship:
    scholarship: Scholarship
    final_score: float
    semantic_score: float
    keyword_score: float
    matched_reasons: list[str] = field(default_factory=list)


@dataclass
class RetrievedDocumentChunk:
    chunk_id: str
    doc_id: str
    filename: str
    scholarship_id: str | None
    text: str
    score: float


@dataclass
class RetrievalOutput:
    results: list[RetrievedScholarship]
    document_chunks: list[RetrievedDocumentChunk]
    confidence: str  # "High" | "Medium" | "Low"
    total_candidates: int


def matches_course(sch_courses: list[str], requested_course: str) -> bool:
    req = requested_course.strip().lower()
    if not req:
        return True
    accepted = COURSE_ALIASES.get(req, {req, "all"})
    for sc in sch_courses:
        sc_low = sc.strip().lower()
        if sc_low == "all" or sc_low == req or sc_low in accepted or req in sc_low:
            return True
    return False


def matches_filters(sch: Scholarship, filters: SearchFilters) -> bool:
    if not sch.is_active:
        return False
    if filters.type and sch.type.lower() != filters.type.strip().lower():
        return False
    if filters.basis and sch.basis.lower() != filters.basis.strip().lower():
        return False
    if filters.source_status and sch.source_status.lower() != filters.source_status.strip().lower():
        return False
    if filters.education_level:
        req_lvl = filters.education_level.strip().lower()
        lvls = [x.strip().lower() for x in (sch.education_level or [])]
        if req_lvl not in lvls and "all" not in lvls:
            return False
    if filters.course:
        if not matches_course(sch.course or [], filters.course):
            return False
    if filters.state:
        req_state = filters.state.strip().lower()
        states_low = [s.strip().lower() for s in (sch.states or [])]
        if "all india" not in states_low and req_state not in states_low:
            return False
    if filters.category:
        req_cat = filters.category.strip().lower()
        cats_low = [c.strip().lower() for c in (sch.categories or [])]
        if "all" not in cats_low and req_cat not in cats_low:
            return False
    if filters.max_income is not None and sch.max_family_income is not None:
        # Student has income `max_income`; exclude schemes whose ceiling is strictly below it
        if sch.max_family_income < filters.max_income:
            return False
    if filters.gender:
        req_gen = filters.gender.strip().lower()
        sch_gen = (sch.gender_requirement or "All").strip().lower()
        if sch_gen != "all" and sch_gen != req_gen:
            return False
    return True


def _compute_keyword_score(query: str, sch: Scholarship) -> tuple[float, list[str]]:
    q_tokens = tokenize_text(query)
    if not q_tokens:
        return 0.0, []

    q_set = set(q_tokens)
    q_expanded = set(expand_synonyms(q_tokens))
    reasons: list[str] = []

    fields: list[tuple[str, str, float]] = [
        ("name", sch.name, 3.0),
        ("provider", sch.provider, 2.0),
        ("course", " ".join(sch.course or []), 2.4),
        ("education_level", " ".join(sch.education_level or []), 2.0),
        ("categories", " ".join(sch.categories or []), 2.2),
        ("states", " ".join(sch.states or []), 2.2),
        ("documents", " ".join(sch.required_documents or []), 1.8),
        ("notes", f"{sch.description or ''} {sch.eligibility_notes or ''}", 1.2),
    ]

    weighted_hits = 0.0
    max_possible = max(len(q_set), 1) * 3.0

    for label, text, weight in fields:
        f_tokens = set(tokenize_text(text))
        exact_overlap = q_set & f_tokens
        syn_overlap = (q_expanded & f_tokens) - exact_overlap
        if exact_overlap:
            weighted_hits += len(exact_overlap) * weight
            if label in ("name", "course", "categories", "states", "documents"):
                reasons.append(f"Matched {label}: {', '.join(sorted(exact_overlap)[:3])}")
        elif syn_overlap:
            weighted_hits += len(syn_overlap) * (weight * 0.45)

    # Exact substring phrase boost
    q_lower = query.strip().lower()
    if len(q_lower) >= 3 and q_lower in sch.name.lower():
        weighted_hits += 4.5
        reasons.append("Exact name match")

    normalized = min(weighted_hits / max(max_possible, 4.0), 1.0)
    return normalized, list(dict.fromkeys(reasons))[:4]


def hybrid_search(
    db: Session,
    query: str,
    filters: SearchFilters | None = None,
    top_k: int = 8,
) -> RetrievalOutput:
    filters = filters or SearchFilters()
    all_scholarships = db.scalars(select(Scholarship).where(Scholarship.is_active.is_(True))).all()
    filtered = [s for s in all_scholarships if matches_filters(s, filters)]

    if not filtered:
        return RetrievalOutput(results=[], document_chunks=[], confidence="Low", total_candidates=0)

    clean_query = (query or "").strip()
    if not clean_query:
        # Pure filter browsing: verified first, then alphabetical
        sorted_items = sorted(
            filtered,
            key=lambda s: (0 if s.source_status == "verified" else 1, s.name.lower()),
        )
        results = [
            RetrievedScholarship(
                scholarship=s,
                final_score=1.0 if s.source_status == "verified" else 0.9,
                semantic_score=0.0,
                keyword_score=0.0,
                matched_reasons=["Matched active filters"],
            )
            for s in sorted_items[:top_k]
        ]
        return RetrievalOutput(
            results=results,
            document_chunks=[],
            confidence="High",
            total_candidates=len(filtered),
        )

    # 1. Semantic retrieval via ChromaDB
    embedder = get_embedding_provider()
    client = get_chroma_client()
    sch_col_name, doc_col_name = _collection_names(embedder)
    sch_col = _get_or_create_collection(client, sch_col_name)
    doc_col = _get_or_create_collection(client, doc_col_name)

    query_vec = embedder.embed_query(clean_query)
    semantic_map: dict[str, float] = {}
    semantic_rank_map: dict[str, int] = {}

    if sch_col.count() > 0:
        n_res = min(max(top_k * 3, 15), sch_col.count())
        chroma_res = sch_col.query(query_embeddings=[query_vec], n_results=n_res)
        ids = (chroma_res.get("ids") or [[]])[0]
        dists = (chroma_res.get("distances") or [[]])[0]
        for rank_idx, (sid, dist) in enumerate(zip(ids, dists), start=1):
            # Cosine distance in [0, 2] -> similarity in [0, 1]
            sim = max(0.0, min(1.0, 1.0 - float(dist)))
            semantic_map[sid] = sim
            semantic_rank_map[sid] = rank_idx

    # 2. Keyword scoring across filtered candidates
    keyword_scores: dict[str, tuple[float, list[str]]] = {}
    for sch in filtered:
        kw_score, reasons = _compute_keyword_score(clean_query, sch)
        keyword_scores[sch.id] = (kw_score, reasons)

    kw_ranked = sorted(
        filtered,
        key=lambda s: keyword_scores[s.id][0],
        reverse=True,
    )
    kw_rank_map = {s.id: idx for idx, s in enumerate(kw_ranked, start=1) if keyword_scores[s.id][0] > 0}

    # 3. Hybrid Reciprocal Rank Fusion + weighted score fusion
    scored: list[RetrievedScholarship] = []
    for sch in filtered:
        sem = semantic_map.get(sch.id, 0.0)
        kw, reasons = keyword_scores[sch.id]

        # Require meaningful signal if query was provided
        rrf = 0.0
        if sch.id in semantic_rank_map:
            rrf += 1.0 / (40 + semantic_rank_map[sch.id])
        if sch.id in kw_rank_map:
            rrf += 1.0 / (40 + kw_rank_map[sch.id])

        verified_bonus = 0.03 if sch.source_status == "verified" else 0.0
        final = round((0.45 * sem) + (0.45 * kw) + (2.5 * rrf) + verified_bonus, 4)

        if sem > 0.25 and not reasons:
            reasons.append("Semantic profile/description similarity")
        elif sem > 0.30:
            reasons.append("Strong semantic similarity")

        scored.append(
            RetrievedScholarship(
                scholarship=sch,
                final_score=final,
                semantic_score=round(sem, 4),
                keyword_score=round(kw, 4),
                matched_reasons=reasons,
            )
        )

    scored.sort(key=lambda r: r.final_score, reverse=True)

    # Filter out totally irrelevant noise if there are zero keyword hits and very weak semantic match
    meaningful = [r for r in scored if r.keyword_score >= 0.08 or r.semantic_score >= 0.22]
    if not meaningful:
        # Check if any semantic results exist above a looser threshold when filters were active
        meaningful = [r for r in scored if r.semantic_score >= 0.14][:top_k]

    top_results = meaningful[:top_k]

    # 4. Query uploaded PDF document chunks if present
    doc_chunks: list[RetrievedDocumentChunk] = []
    if doc_col.count() > 0:
        n_doc = min(4, doc_col.count())
        doc_res = doc_col.query(query_embeddings=[query_vec], n_results=n_doc)
        d_ids = (doc_res.get("ids") or [[]])[0]
        d_docs = (doc_res.get("documents") or [[]])[0]
        d_metas = (doc_res.get("metadatas") or [[]])[0]
        d_dists = (doc_res.get("distances") or [[]])[0]
        for cid, txt, meta, dist in zip(d_ids, d_docs, d_metas, d_dists):
            sim = max(0.0, min(1.0, 1.0 - float(dist)))
            if sim >= 0.18:
                doc_chunks.append(
                    RetrievedDocumentChunk(
                        chunk_id=cid,
                        doc_id=str(meta.get("doc_id", "")),
                        filename=str(meta.get("filename", "uploaded.pdf")),
                        scholarship_id=meta.get("scholarship_id") or None,
                        text=txt,
                        score=round(sim, 4),
                    )
                )

    # 5. Qualitative Confidence (High / Medium / Low — never percentage)
    if not top_results:
        confidence = "Low"
    else:
        best = top_results[0]
        if best.keyword_score >= 0.28 or (best.semantic_score >= 0.42 and best.keyword_score >= 0.12):
            confidence = "High"
        elif best.keyword_score >= 0.12 or best.semantic_score >= 0.26:
            confidence = "Medium"
        else:
            confidence = "Low"

    return RetrievalOutput(
        results=top_results,
        document_chunks=doc_chunks,
        confidence=confidence,
        total_candidates=len(filtered),
    )
