import time
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.entities import SearchLog
from app.schemas.eligibility import EligibilityCheckResponse, StudentProfile
from app.services.eligibility_engine import check_eligibility

router = APIRouter(prefix="/api/eligibility", tags=["Eligibility"])


@router.post("/check", response_model=EligibilityCheckResponse)
def check_student_eligibility(
    profile: StudentProfile,
    db: Session = Depends(get_db),
):
    t0 = time.perf_counter()
    result = check_eligibility(db=db, profile=profile)
    latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    # Anonymized summary log (no personal identifiers stored)
    summary_query = f"eligibility:{profile.course or 'any'}|lvl:{profile.education_level or 'any'}|cat:{profile.category or 'any'}"
    db.add(
        SearchLog(
            query=summary_query[:300],
            endpoint="/api/eligibility/check",
            intent="eligibility",
            result_count=result.summary["eligible_count"] + result.summary["potentially_eligible_count"],
            is_failed=False,
            latency_ms=latency_ms,
        )
    )
    db.commit()
    return result
