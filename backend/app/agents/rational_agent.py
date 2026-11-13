import time
from sqlalchemy.orm import Session

from app.agents.nlu import classify_intent, extract_entities
from app.models.entities import SearchLog
from app.rag.retriever import SearchFilters, hybrid_search
from app.schemas.chat import (
    AgentExplanationTrace,
    AgentTraceStep,
    ChatMessageInput,
    ChatRequest,
    ChatResponse,
    CitationSource,
)
from app.schemas.eligibility import StudentProfile
from app.services.eligibility_engine import check_eligibility
from app.services.llm_provider import get_llm_provider
from app.utils.privacy import scrub_pii


def _build_retrieval_query(clean_query: str, profile: StudentProfile, intent: str) -> str:
    extra_terms = []
    if profile.course and profile.course.lower() not in clean_query.lower():
        extra_terms.append(profile.course)
    if profile.education_level and profile.education_level.lower() not in clean_query.lower():
        extra_terms.append(profile.education_level)
    if profile.state and profile.state.lower() not in clean_query.lower():
        extra_terms.append(profile.state)
    if profile.category and profile.category.lower() not in clean_query.lower():
        extra_terms.append(profile.category)
    if intent == "documents" and "document" not in clean_query.lower():
        extra_terms.append("required documents")
    return f"{clean_query} {' '.join(extra_terms)}".strip()


def run_rational_agent(db: Session, request: ChatRequest) -> ChatResponse:
    t0 = time.perf_counter()

    # 1. Perceive + Scrub PII
    clean_message, privacy_warnings = scrub_pii(request.message)
    clean_history: list[ChatMessageInput] = []
    for msg in request.history[-6:]:
        c_msg, h_warn = scrub_pii(msg.content)
        privacy_warnings.extend(h_warn)
        clean_history.append(ChatMessageInput(role=msg.role, content=c_msg))
    privacy_warnings = list(dict.fromkeys(privacy_warnings))

    # 2. Interpret intent
    intent = classify_intent(clean_message)

    # 3. Extract non-identifying student entities
    merged_profile, newly_extracted = extract_entities(clean_message, request.profile_context)

    # 4. Retrieve from ChromaDB + SQLite hybrid index
    retrieval_query = _build_retrieval_query(clean_message, merged_profile, intent)
    filters = SearchFilters()
    # Apply strict filter only when user explicitly asks for a specific course or state in a discovery/eligibility query
    if newly_extracted.get("gender") == "Male":
        filters.gender = "Male"
    if intent == "general" and len(clean_message.split()) <= 4 and not newly_extracted:
        # Simple greeting -> don't force noisy retrieval
        retrieval_out = hybrid_search(db, query="", top_k=3)
        retrieval_out.results = []
    else:
        retrieval_out = hybrid_search(db, query=retrieval_query, filters=filters, top_k=6)

    # 5. Evaluate deterministic eligibility rules (NO LLM)
    retrieved_ids = [r.scholarship.id for r in retrieval_out.results]
    has_profile_data = any(
        val is not None
        for val in (
            merged_profile.education_level,
            merged_profile.course,
            merged_profile.percentage,
            merged_profile.cgpa,
            merged_profile.family_income,
            merged_profile.state,
            merged_profile.category,
            merged_profile.gender,
        )
    )
    eligibility_result = (
        check_eligibility(db, merged_profile)
        if (has_profile_data or intent in ("eligibility", "discovery"))
        else None
    )

    # If user provided student profile data and eligibility found matching eligible schemes,
    # ensure top eligible schemes are represented in retrieved citations
    if eligibility_result and has_profile_data and intent in ("eligibility", "discovery"):
        existing_ids = {r.scholarship.id for r in retrieval_out.results}
        for ev in eligibility_result.eligible[:3]:
            if ev.scholarship.id not in existing_ids:
                # Fetch ORM scholarship via existing retrieved list or DB query
                from app.models.entities import Scholarship
                sch_obj = db.get(Scholarship, ev.scholarship.id)
                if sch_obj:
                    from app.rag.retriever import RetrievedScholarship
                    retrieval_out.results.append(
                        RetrievedScholarship(
                            scholarship=sch_obj,
                            final_score=0.75,
                            semantic_score=0.45,
                            keyword_score=0.45,
                            matched_reasons=["Matched deterministic eligibility criteria"],
                        )
                    )
                    existing_ids.add(sch_obj.id)
        # Re-rank so deterministic eligible schemes surface prominently
        eligible_set = {e.scholarship.id for e in eligibility_result.eligible}
        not_eligible_set = {e.scholarship.id for e in eligibility_result.not_eligible}
        retrieval_out.results.sort(
            key=lambda r: (
                0 if r.scholarship.id in eligible_set else (2 if r.scholarship.id in not_eligible_set else 1),
                -r.final_score,
            )
        )
        retrieval_out.results = retrieval_out.results[:6]

    # 6. Reason via LLMProvider (GeminiProvider or DemoProvider)
    llm = get_llm_provider()
    generated = llm.generate_rag_response(
        query=clean_message,
        intent=intent,
        profile=merged_profile,
        retrieved=retrieval_out.results,
        doc_chunks=retrieval_out.document_chunks,
        eligibility_result=eligibility_result,
        history=clean_history,
    )

    # 7. Respond with full citations, confidence, limitations & disclaimer
    eval_status_map = {}
    if eligibility_result:
        for ev in (
            eligibility_result.eligible
            + eligibility_result.potentially_eligible
            + eligibility_result.not_eligible
        ):
            eval_status_map[ev.scholarship.id] = ev.status

    citations: list[CitationSource] = []
    for item in retrieval_out.results:
        s = item.scholarship
        citations.append(
            CitationSource(
                id=s.id,
                name=s.name,
                provider=s.provider,
                type=s.type,
                basis=s.basis,
                official_url=s.official_url,
                source_status=s.source_status,  # type: ignore[arg-type]
                last_verified=s.last_verified,
                deadline=s.deadline,
                amount=s.amount,
                relevance_score=round(item.final_score, 3),
                eligibility_status=eval_status_map.get(s.id),
                snippet=(s.description or "")[:180],
            )
        )

    # 8. Explain ("How did AI reach this result?")
    trace_steps = [
        AgentTraceStep(
            stage="1. Perceive",
            title="Privacy-Safe Input Normalization",
            detail=(
                "Checked input for sensitive PII (Aadhaar/PAN/bank/OTP) and scrubbed before processing."
                if privacy_warnings
                else "Validated query with zero sensitive PII detected."
            ),
        ),
        AgentTraceStep(
            stage="2. Interpret Intent",
            title=f"Classified Intent: {intent}",
            detail=f"Interpreted user goal as '{intent.replace('_', ' ')}'.",
        ),
        AgentTraceStep(
            stage="3. Extract Entities",
            title="Non-Identifying Profile Extraction",
            detail=(
                f"Extracted attributes: {newly_extracted}"
                if newly_extracted
                else "No new demographic/academic thresholds detected in this message."
            ),
        ),
        AgentTraceStep(
            stage="4. Retrieve",
            title=f"Hybrid RAG Search ({len(citations)} citations, {len(retrieval_out.document_chunks)} PDF chunks)",
            detail=(
                f"Embedded query and combined ChromaDB cosine similarity with SQLite keyword & filter scoring "
                f"(retrieval confidence: {retrieval_out.confidence})."
            ),
        ),
        AgentTraceStep(
            stage="5. Evaluate Eligibility",
            title="Deterministic Rule Engine (Zero LLM)",
            detail=(
                f"Evaluated {eligibility_result.summary['total_evaluated']} active schemes: "
                f"{eligibility_result.summary['eligible_count']} eligible, "
                f"{eligibility_result.summary['potentially_eligible_count']} potentially eligible, "
                f"{eligibility_result.summary['not_eligible_count']} not eligible."
                if eligibility_result
                else "Skipped full rule matrix because query was a general greeting."
            ),
        ),
        AgentTraceStep(
            stage="6. Reason & Ground",
            title=f"Grounded Synthesis via {llm.provider_name}",
            detail=(
                "Passed only retrieved scholarship records, PDF excerpts, and rule outputs with strict anti-hallucination constraints."
            ),
        ),
    ]

    trace = AgentExplanationTrace(
        intent=intent,
        extracted_entities=merged_profile.model_dump(exclude_none=True),
        sources_used=[f"{c.name} ({c.source_status})" for c in citations],
        provider_mode=llm.provider_name,
        steps=trace_steps,
    )

    # Log anonymized analytics (never stores student PII)
    latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    db.add(
        SearchLog(
            query=clean_message[:300],
            endpoint="/api/chat",
            intent=intent,
            result_count=len(citations),
            is_failed=(len(citations) == 0 and intent != "general"),
            latency_ms=latency_ms,
        )
    )
    db.commit()

    return ChatResponse(
        answer=generated.answer_markdown,
        intent=intent,
        sources=citations,
        eligibility_reasoning=generated.eligibility_reasoning,
        confidence=retrieval_out.confidence,  # type: ignore[arg-type]
        limitations=generated.limitations,
        follow_up_questions=generated.follow_up_questions,
        extracted_profile=merged_profile,
        privacy_warnings=privacy_warnings,
        disclaimer="Final eligibility is decided by the provider.",
        demo_mode=llm.is_demo,
        trace=trace,
    )
