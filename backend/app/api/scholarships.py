import math
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.knowledge_base.loader import get_scholarship_knowledge_graph
from app.models.entities import IngestedDocument, Scholarship
from app.rag.retriever import SearchFilters, matches_filters
from app.schemas.admin import IngestedDocumentOut
from app.schemas.scholarship import (
    KnowledgeEdgeOut,
    ScholarshipListResponse,
    ScholarshipOut,
)
from app.utils.config import get_settings

router = APIRouter(prefix="/api", tags=["Scholarships"])


class ScholarshipDetailResponse(ScholarshipOut):
    knowledge_graph: dict
    related_documents: list[IngestedDocumentOut]


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    settings = get_settings()
    all_sch = db.scalars(select(Scholarship).where(Scholarship.is_active.is_(True))).all()
    states_set: set[str] = set()
    courses_set: set[str] = set()
    levels_set: set[str] = set()
    categories_set: set[str] = set()

    for s in all_sch:
        for st in s.states or []:
            if st != "All India":
                states_set.add(st)
        for c in s.course or []:
            if c != "All":
                courses_set.add(c)
        for lvl in s.education_level or []:
            levels_set.add(lvl)
        for cat in s.categories or []:
            if cat != "All":
                categories_set.add(cat)

    return {
        "total_scholarships": len(all_sch),
        "verified_count": sum(1 for s in all_sch if s.source_status == "verified"),
        "sample_count": sum(1 for s in all_sch if s.source_status == "sample"),
        "government_count": sum(1 for s in all_sch if s.type == "government"),
        "private_count": sum(1 for s in all_sch if s.type == "private"),
        "university_count": sum(1 for s in all_sch if s.type == "university"),
        "states_covered": len(states_set),
        "demo_mode": settings.is_demo_mode,
        "filter_options": {
            "states": ["All India", *sorted(states_set)],
            "courses": sorted(courses_set),
            "education_levels": sorted(levels_set),
            "categories": sorted(categories_set),
        },
    }


@router.get("/scholarships", response_model=ScholarshipListResponse)
def list_scholarships(
    q: str | None = Query(default=None),
    type: str | None = Query(default=None),
    basis: str | None = Query(default=None),
    education_level: str | None = Query(default=None),
    course: str | None = Query(default=None),
    state: str | None = Query(default=None),
    category: str | None = Query(default=None),
    max_income: float | None = Query(default=None, ge=0),
    source_status: str | None = Query(default=None),
    gender: str | None = Query(default=None),
    sort_by: str = Query(default="verified", pattern="^(name|income_limit|verified|updated_at)$"),
    sort_order: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=100),
    db: Session = Depends(get_db),
):
    all_sch = db.scalars(select(Scholarship).where(Scholarship.is_active.is_(True))).all()
    filters = SearchFilters(
        type=type,
        basis=basis,
        education_level=education_level,
        course=course,
        state=state,
        category=category,
        max_income=max_income,
        source_status=source_status,
        gender=gender,
    )
    filtered = [s for s in all_sch if matches_filters(s, filters)]

    if q and q.strip():
        ql = q.strip().lower()
        filtered = [
            s
            for s in filtered
            if (
                ql in s.name.lower()
                or ql in s.provider.lower()
                or ql in (s.description or "").lower()
                or any(ql in c.lower() for c in (s.course or []))
                or any(ql in st.lower() for st in (s.states or []))
                or any(ql in cat.lower() for cat in (s.categories or []))
            )
        ]

    reverse = sort_order == "desc"
    if sort_by == "name":
        filtered.sort(key=lambda s: s.name.lower(), reverse=reverse)
    elif sort_by == "income_limit":
        filtered.sort(
            key=lambda s: (s.max_family_income is None, s.max_family_income or 0.0),
            reverse=reverse,
        )
    elif sort_by == "updated_at":
        filtered.sort(key=lambda s: s.updated_at.timestamp() if s.updated_at else 0.0, reverse=not reverse)
    else:
        # Default: verified first, then alphabetical
        filtered.sort(
            key=lambda s: (0 if s.source_status == "verified" else 1, s.name.lower()),
            reverse=reverse,
        )

    total = len(filtered)
    total_pages = max(1, math.ceil(total / page_size))
    start = (page - 1) * page_size
    items = filtered[start : start + page_size]

    return ScholarshipListResponse(
        items=[ScholarshipOut.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/scholarships/{scholarship_id}", response_model=ScholarshipDetailResponse)
def get_scholarship_detail(scholarship_id: str, db: Session = Depends(get_db)):
    sch = db.get(Scholarship, scholarship_id)
    if not sch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scholarship '{scholarship_id}' not found.",
        )

    kg = get_scholarship_knowledge_graph(db, scholarship_id)
    kg_payload = {
        "scholarship_id": kg["scholarship_id"],
        "nodes": kg["nodes"],
        "edges": [KnowledgeEdgeOut.model_validate(e).model_dump() for e in kg["edges"]],
    }

    docs = db.scalars(
        select(IngestedDocument).where(IngestedDocument.scholarship_id == scholarship_id)
    ).all()

    base = ScholarshipOut.model_validate(sch).model_dump()
    return ScholarshipDetailResponse(
        **base,
        knowledge_graph=kg_payload,
        related_documents=[IngestedDocumentOut.model_validate(d) for d in docs],
    )
