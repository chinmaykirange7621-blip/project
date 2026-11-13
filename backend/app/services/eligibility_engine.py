from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Scholarship
from app.rag.retriever import matches_course
from app.schemas.eligibility import (
    EligibilityCheckResponse,
    EligibilityEvaluation,
    StudentProfile,
)
from app.schemas.scholarship import ScholarshipOut


STATE_ALIASES: dict[str, str] = {
    "up": "uttar pradesh",
    "mh": "maharashtra",
    "wb": "west bengal",
    "ka": "karnataka",
    "tn": "tamil nadu",
    "dl": "delhi",
    "rj": "rajasthan",
    "gj": "gujarat",
    "mp": "madhya pradesh",
    "ap": "andhra pradesh",
    "ts": "telangana",
    "kl": "kerala",
    "br": "bihar",
    "pb": "punjab",
    "hr": "haryana",
}

SPECIAL_CONDITION_SCHEMES: dict[str, str] = {
    "aicte-swanath-degree": "Requires orphan, COVID-affected parent loss, or Armed Forces/CAPF martyr ward verification.",
    "pmss-capf-ar": "Requires CAPF / Assam Rifles / State Police dependent service certificate.",
    "nsp-top-class-sc-st": "Requires admission to an institute notified on the NSP Top Class institution list.",
    "tn-pudhumai-penn": "Requires Classes 6-12 Tamil Nadu Government School study (Pudhumai Penn) or First Graduate certificate.",
    "aicte-saksham-degree": "Requires valid UDID / Disability Certificate showing >=40% disability.",
    "aicte-pragati-degree": "Limited to up to two girl children per family in an AICTE-approved institution.",
}


def normalize_state(state: str | None) -> str | None:
    if not state:
        return None
    s = state.strip().lower()
    return STATE_ALIASES.get(s, s)


def normalize_level(level: str | None, course: str | None) -> str | None:
    if level:
        lv = level.strip().lower()
        if lv in ("ug", "undergraduate", "bachelor", "bachelors", "graduation"):
            return "ug"
        if lv in ("pg", "postgraduate", "master", "masters"):
            return "pg"
        if "diploma" in lv or "polytechnic" in lv:
            return "diploma"
        if "11" in lv or "12" in lv or "higher secondary" in lv:
            return "class 11-12"
        if "phd" in lv or "doctoral" in lv:
            return "phd"
        return lv

    if course:
        c = course.strip().lower()
        if any(k in c for k in ("b.tech", "btech", "b.e", "cse", "ai&ml", "b.sc", "b.com", "b.a", "bca", "mbbs", "b.arch")):
            return "ug"
        if any(k in c for k in ("m.tech", "mtech", "m.sc", "mca", "mba", "m.a")):
            return "pg"
        if "diploma" in c:
            return "diploma"
    return None


def evaluate_scholarship(profile: StudentProfile, sch: Scholarship) -> EligibilityEvaluation:
    met: list[str] = []
    unmet: list[str] = []
    missing: list[str] = []
    notes: list[str] = []

    if sch.source_status == "sample":
        notes.append("Sample data – verify exact eligibility rules and dates on the official portal.")

    inferred_level = normalize_level(profile.education_level, profile.course)

    # 1. Education level
    sch_levels = [lvl.strip().lower() for lvl in (sch.education_level or [])]
    if inferred_level:
        if "all" in sch_levels or inferred_level in sch_levels:
            met.append(f"Education level '{inferred_level.upper()}' matches supported levels ({', '.join(sch.education_level)})")
        else:
            unmet.append(f"Education level '{inferred_level.upper()}' is not in supported levels ({', '.join(sch.education_level)})")
    else:
        missing.append(f"Education level not provided (scheme supports: {', '.join(sch.education_level)})")

    # 2. Course / Stream
    sch_courses = sch.course or []
    sch_courses_low = [c.strip().lower() for c in sch_courses]
    if profile.course:
        if matches_course(sch_courses, profile.course):
            met.append(f"Course '{profile.course}' is supported ({', '.join(sch_courses[:4])})")
        else:
            unmet.append(f"Course '{profile.course}' does not match scheme courses ({', '.join(sch_courses)})")
    elif "all" not in sch_courses_low:
        missing.append(f"Course/branch not provided (scheme applies to: {', '.join(sch_courses)})")
    else:
        met.append("Open to all courses/streams")

    # 3. Gender requirement
    gen_req = (sch.gender_requirement or "All").strip()
    if gen_req.lower() != "all":
        if profile.gender:
            if profile.gender.strip().lower() == gen_req.lower():
                met.append(f"Meets gender requirement ({gen_req})")
            else:
                unmet.append(f"Restricted exclusively to {gen_req} applicants (provided: {profile.gender})")
        else:
            missing.append(f"Gender not provided (scheme is exclusively for {gen_req} applicants)")

    # 4. State domicile
    sch_states = sch.states or []
    sch_states_low = [s.strip().lower() for s in sch_states]
    if "all india" in sch_states_low:
        met.append("State eligibility: All India")
    else:
        norm_state = normalize_state(profile.state)
        if norm_state:
            if norm_state in sch_states_low:
                met.append(f"Domicile state '{profile.state}' matches scheme state ({', '.join(sch_states)})")
            else:
                unmet.append(f"Restricted to {', '.join(sch_states)} domicile (provided: {profile.state})")
        else:
            missing.append(f"Domicile state not provided (restricted to: {', '.join(sch_states)})")

    # 5. Category
    sch_cats = sch.categories or []
    sch_cats_low = [c.strip().lower() for c in sch_cats]
    if "all" in sch_cats_low:
        met.append("Open to all social categories")
    else:
        if profile.category:
            req_cat = profile.category.strip().lower()
            if req_cat in sch_cats_low:
                met.append(f"Category '{profile.category}' is eligible ({', '.join(sch_cats)})")
            else:
                unmet.append(f"Category '{profile.category}' is not in eligible categories ({', '.join(sch_cats)})")
        else:
            missing.append(f"Category not provided (scheme restricted to: {', '.join(sch_cats)})")

    # 6. Annual family income
    if sch.max_family_income is not None:
        if profile.family_income is not None:
            if profile.family_income <= sch.max_family_income:
                met.append(
                    f"Family income ₹{int(profile.family_income):,}/yr is within ₹{int(sch.max_family_income):,}/yr ceiling"
                )
            else:
                unmet.append(
                    f"Family income ₹{int(profile.family_income):,}/yr exceeds maximum limit of ₹{int(sch.max_family_income):,}/yr"
                )
        else:
            missing.append(f"Annual family income not provided (ceiling: ₹{int(sch.max_family_income):,}/yr)")
    else:
        met.append("No fixed annual family income cap specified")

    # 7. Academic score (CGPA / Percentage)
    if sch.min_cgpa is not None:
        if profile.cgpa is not None:
            if profile.cgpa >= sch.min_cgpa:
                met.append(f"CGPA {profile.cgpa} meets minimum {sch.min_cgpa} CGPA requirement")
            else:
                unmet.append(f"CGPA {profile.cgpa} is below minimum required {sch.min_cgpa} CGPA")
        elif profile.percentage is not None:
            est_cgpa = round(profile.percentage / 9.5, 2)
            if est_cgpa >= sch.min_cgpa:
                met.append(
                    f"Estimated CGPA {est_cgpa} (from {profile.percentage}% using 9.5 scale) meets >= {sch.min_cgpa} CGPA"
                )
                notes.append("CGPA estimated from percentage on a 9.5x scale; verify official university conversion rule.")
            else:
                unmet.append(
                    f"Estimated CGPA {est_cgpa} (from {profile.percentage}%) is below minimum {sch.min_cgpa} CGPA"
                )
        else:
            missing.append(f"CGPA or percentage not provided (minimum {sch.min_cgpa} CGPA required)")

    if sch.min_percentage is not None:
        if profile.percentage is not None:
            if profile.percentage >= sch.min_percentage:
                met.append(f"Score {profile.percentage}% meets minimum {sch.min_percentage}% requirement")
            else:
                unmet.append(f"Score {profile.percentage}% is below minimum required {sch.min_percentage}%")
        elif profile.cgpa is not None:
            est_pct = round(profile.cgpa * 9.5, 2)
            if est_pct >= sch.min_percentage:
                met.append(
                    f"Estimated {est_pct}% (from {profile.cgpa} CGPA on 9.5x scale) meets >= {sch.min_percentage}% screening threshold"
                )
                notes.append("Percentage estimated via CGPA × 9.5; verify official board/university conversion.")
            else:
                unmet.append(
                    f"Estimated {est_pct}% (from {profile.cgpa} CGPA) is below minimum {sch.min_percentage}%"
                )
        else:
            missing.append(f"Percentage or CGPA not provided (minimum {sch.min_percentage}% required)")

    # 8. Special statutory verification caveats
    if sch.id in SPECIAL_CONDITION_SCHEMES and not unmet:
        missing.append(SPECIAL_CONDITION_SCHEMES[sch.id])

    # Determine deterministic bucket
    if unmet:
        status = "not_eligible"
    elif not missing:
        status = "eligible"
    else:
        status = "potentially_eligible"

    return EligibilityEvaluation(
        scholarship=ScholarshipOut.model_validate(sch),
        status=status,
        met_conditions=met,
        unmet_conditions=unmet,
        missing_requirements=missing,
        notes=notes,
    )


def check_eligibility(
    db: Session,
    profile: StudentProfile,
    scholarship_ids: list[str] | None = None,
) -> EligibilityCheckResponse:
    stmt = select(Scholarship).where(Scholarship.is_active.is_(True))
    if scholarship_ids:
        stmt = stmt.where(Scholarship.id.in_(scholarship_ids))
    scholarships = db.scalars(stmt).all()

    eligible: list[EligibilityEvaluation] = []
    potentially: list[EligibilityEvaluation] = []
    not_eligible: list[EligibilityEvaluation] = []

    for sch in scholarships:
        ev = evaluate_scholarship(profile, sch)
        if ev.status == "eligible":
            eligible.append(ev)
        elif ev.status == "potentially_eligible":
            potentially.append(ev)
        else:
            not_eligible.append(ev)

    # Sort verified first, then name
    key_fn = lambda e: (0 if e.scholarship.source_status == "verified" else 1, e.scholarship.name.lower())
    eligible.sort(key=key_fn)
    potentially.sort(key=lambda e: (len(e.missing_requirements), 0 if e.scholarship.source_status == "verified" else 1, e.scholarship.name.lower()))
    not_eligible.sort(key=lambda e: (len(e.unmet_conditions), e.scholarship.name.lower()))

    missing_fields: list[str] = []
    if not normalize_level(profile.education_level, profile.course):
        missing_fields.append("education_level")
    if not profile.course:
        missing_fields.append("course")
    if profile.cgpa is None and profile.percentage is None:
        missing_fields.append("score (CGPA or percentage)")
    if profile.family_income is None:
        missing_fields.append("family_income")
    if not profile.state:
        missing_fields.append("state")
    if not profile.category:
        missing_fields.append("category")
    if not profile.gender:
        missing_fields.append("gender")

    return EligibilityCheckResponse(
        profile=profile,
        eligible=eligible,
        potentially_eligible=potentially,
        not_eligible=not_eligible,
        summary={
            "total_evaluated": len(scholarships),
            "eligible_count": len(eligible),
            "potentially_eligible_count": len(potentially),
            "not_eligible_count": len(not_eligible),
        },
        missing_profile_fields=missing_fields,
    )
