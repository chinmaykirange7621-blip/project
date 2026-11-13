import threading
import chromadb
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.embeddings.provider import EmbeddingProvider, get_embedding_provider
from app.models.entities import Scholarship
from app.utils.config import get_settings


_CHROMA_LOCK = threading.Lock()
_CLIENT_CACHE: dict[str, chromadb.PersistentClient] = {}


def get_chroma_client() -> chromadb.PersistentClient:
    settings = get_settings()
    persist_path = str(settings.resolved_chroma_dir)
    with _CHROMA_LOCK:
        if persist_path not in _CLIENT_CACHE:
            _CLIENT_CACHE[persist_path] = chromadb.PersistentClient(path=persist_path)
        return _CLIENT_CACHE[persist_path]


def _collection_names(embedder: EmbeddingProvider) -> tuple[str, str]:
    suffix = embedder.mode_name
    return f"scholarships_{suffix}", f"documents_{suffix}"


def _get_or_create_collection(client: chromadb.PersistentClient, name: str):
    return client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )


def format_scholarship_text(sch: Scholarship) -> str:
    income_str = (
        f"INR {int(sch.max_family_income):,} ({sch.max_family_income / 100000:.2f} lakh per year)"
        if sch.max_family_income is not None
        else "No specific income limit specified"
    )
    score_parts = []
    if sch.min_percentage is not None:
        score_parts.append(f"Minimum {sch.min_percentage}% marks")
    if sch.min_cgpa is not None:
        score_parts.append(f"Minimum {sch.min_cgpa} CGPA")
    score_str = ", ".join(score_parts) if score_parts else "No fixed minimum score specified"

    return (
        f"Scholarship Name: {sch.name}\n"
        f"Provider: {sch.provider}\n"
        f"Type: {sch.type} | Basis: {sch.basis} | Source Status: {sch.source_status}\n"
        f"Education Level: {', '.join(sch.education_level or [])}\n"
        f"Courses Supported: {', '.join(sch.course or [])}\n"
        f"Score Criteria: {score_str}\n"
        f"Family Income Limit: {income_str}\n"
        f"Eligible States: {', '.join(sch.states or [])}\n"
        f"Eligible Categories: {', '.join(sch.categories or [])}\n"
        f"Gender Requirement: {sch.gender_requirement or 'All'}\n"
        f"Amount / Benefit: {sch.amount or 'Not available'}\n"
        f"Deadline: {sch.deadline or 'Not available (check official portal)'}\n"
        f"Required Documents: {', '.join(sch.required_documents or [])}\n"
        f"Description: {sch.description or ''}\n"
        f"Eligibility Notes: {sch.eligibility_notes or ''}\n"
        f"Application Steps: {' '.join(sch.application_steps or [])}\n"
        f"Official URL: {sch.official_url}"
    )


def _scholarship_metadata(sch: Scholarship) -> dict:
    return {
        "id": sch.id,
        "name": sch.name,
        "provider": sch.provider,
        "type": sch.type,
        "basis": sch.basis,
        "source_status": sch.source_status,
        "states": "|".join(sch.states or []),
        "categories": "|".join(sch.categories or []),
        "education_level": "|".join(sch.education_level or []),
        "course": "|".join(sch.course or []),
        "max_family_income": float(sch.max_family_income) if sch.max_family_income is not None else -1.0,
        "min_percentage": float(sch.min_percentage) if sch.min_percentage is not None else -1.0,
        "min_cgpa": float(sch.min_cgpa) if sch.min_cgpa is not None else -1.0,
        "gender_requirement": sch.gender_requirement or "All",
    }


def index_all_scholarships(db: Session, force_reindex: bool = False) -> int:
    embedder = get_embedding_provider()
    client = get_chroma_client()
    sch_col_name, _ = _collection_names(embedder)
    collection = _get_or_create_collection(client, sch_col_name)

    scholarships = db.scalars(select(Scholarship).where(Scholarship.is_active.is_(True))).all()
    if not scholarships:
        return 0

    existing_ids = set(collection.get(include=[])["ids"])
    current_ids = {s.id for s in scholarships}

    # Delete stale IDs
    stale_ids = list(existing_ids - current_ids)
    if stale_ids:
        collection.delete(ids=stale_ids)

    if not force_reindex and existing_ids == current_ids and len(existing_ids) == len(scholarships):
        return len(existing_ids)

    ids = [s.id for s in scholarships]
    docs = [format_scholarship_text(s) for s in scholarships]
    metadatas = [_scholarship_metadata(s) for s in scholarships]
    embeddings = embedder.embed_documents(docs)

    collection.upsert(
        ids=ids,
        documents=docs,
        metadatas=metadatas,
        embeddings=embeddings,
    )
    return len(ids)


def upsert_scholarship_vector(sch: Scholarship) -> None:
    embedder = get_embedding_provider()
    client = get_chroma_client()
    sch_col_name, _ = _collection_names(embedder)
    collection = _get_or_create_collection(client, sch_col_name)

    if not sch.is_active:
        try:
            collection.delete(ids=[sch.id])
        except Exception:
            pass
        return

    doc = format_scholarship_text(sch)
    emb = embedder.embed_documents([doc])[0]
    collection.upsert(
        ids=[sch.id],
        documents=[doc],
        metadatas=[_scholarship_metadata(sch)],
        embeddings=[emb],
    )


def delete_scholarship_vector(scholarship_id: str) -> None:
    embedder = get_embedding_provider()
    client = get_chroma_client()
    sch_col_name, _ = _collection_names(embedder)
    collection = _get_or_create_collection(client, sch_col_name)
    try:
        collection.delete(ids=[scholarship_id])
    except Exception:
        pass


def index_pdf_chunks(
    doc_id: str,
    filename: str,
    scholarship_id: str | None,
    chunks: list[str],
) -> int:
    if not chunks:
        return 0
    embedder = get_embedding_provider()
    client = get_chroma_client()
    _, doc_col_name = _collection_names(embedder)
    collection = _get_or_create_collection(client, doc_col_name)

    ids = [f"{doc_id}::chunk_{idx}" for idx in range(len(chunks))]
    metadatas = [
        {
            "doc_id": doc_id,
            "filename": filename,
            "scholarship_id": scholarship_id or "",
            "chunk_index": idx,
        }
        for idx in range(len(chunks))
    ]
    embeddings = embedder.embed_documents(chunks)
    collection.upsert(
        ids=ids,
        documents=chunks,
        metadatas=metadatas,
        embeddings=embeddings,
    )
    return len(ids)


def delete_pdf_chunks(doc_id: str) -> None:
    embedder = get_embedding_provider()
    client = get_chroma_client()
    _, doc_col_name = _collection_names(embedder)
    collection = _get_or_create_collection(client, doc_col_name)
    try:
        collection.delete(where={"doc_id": doc_id})
    except Exception:
        pass


def get_vector_counts() -> dict[str, int]:
    embedder = get_embedding_provider()
    client = get_chroma_client()
    sch_col_name, doc_col_name = _collection_names(embedder)
    sch_col = _get_or_create_collection(client, sch_col_name)
    doc_col = _get_or_create_collection(client, doc_col_name)
    return {
        "scholarships_indexed": sch_col.count(),
        "document_chunks_indexed": doc_col.count(),
        "embedding_mode": embedder.mode_name,
    }
