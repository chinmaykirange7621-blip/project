import time
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.entities import SearchLog
from app.rag.retriever import SearchFilters, hybrid_search
from app.schemas.scholarship import ScholarshipOut

router = APIRouter(prefix="/api", tags=["Search"])


class SearchHit(BaseModel):
    scholarship: ScholarshipOut
    score: float
    semantic_score: float
    keyword_score: float
    matched_reasons: list[str]


class DocumentChunkHit(BaseModel):
    chunk_id: str
    doc_id: str
    filename: str
    scholarship_id: str | None = None
    text: str
    score: float


class SearchResponse(BaseModel):
    query: str
    total: int
    confidence: str
    results: list[SearchHit]
    document_chunks: list[DocumentChunkHit]


@router.get("/search", response_model=SearchResponse)
def search_scholarships(
    q: str = Query(default="", max_length=500),
    type: str | None = Query(default=None),
    basis: str | None = Query(default=None),
    education_level: str | None = Query(default=None),
    course: str | None = Query(default=None),
    state: str | None = Query(default=None),
    category: str | None = Query(default=None),
    max_income: float | None = Query(default=None, ge=0),
    source_status: str | None = Query(default=None),
    limit: int = Query(default=12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    t0 = time.perf_counter()
    filters = SearchFilters(
        type=type,
        basis=basis,
        education_level=education_level,
        course=course,
        state=state,
        category=category,
        max_income=max_income,
        source_status=source_status,
    )
    out = hybrid_search(db=db, query=q, filters=filters, top_k=limit)
    latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    if q.strip():
        db.add(
            SearchLog(
                query=q.strip()[:300],
                endpoint="/api/search",
                intent="discovery",
                result_count=len(out.results),
                is_failed=(len(out.results) == 0),
                latency_ms=latency_ms,
            )
        )
        db.commit()

    return SearchResponse(
        query=q,
        total=len(out.results),
        confidence=out.confidence,
        results=[
            SearchHit(
                scholarship=ScholarshipOut.model_validate(r.scholarship),
                score=r.final_score,
                semantic_score=r.semantic_score,
                keyword_score=r.keyword_score,
                matched_reasons=r.matched_reasons,
            )
            for r in out.results
        ],
        document_chunks=[
            DocumentChunkHit(
                chunk_id=c.chunk_id,
                doc_id=c.doc_id,
                filename=c.filename,
                scholarship_id=c.scholarship_id,
                text=c.text,
                score=c.score,
            )
            for c in out.document_chunks
        ],
    )
