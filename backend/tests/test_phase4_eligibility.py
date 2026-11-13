from app.database.session import SessionLocal, init_db
from app.knowledge_base.loader import seed_database
from app.schemas.eligibility import StudentProfile
from app.services.eligibility_engine import check_eligibility


def test_eligibility_btech_student_full_profile():
    init_db()
    with SessionLocal() as db:
        seed_database(db)
        profile = StudentProfile(
            education_level="UG",
            course="B.Tech",
            cgpa=8.5,
            family_income=250000,
            state="Maharashtra",
            category="General",
            gender="Male",
        )
        res = check_eligibility(db, profile)
        assert res.summary["total_evaluated"] >= 20

        eligible_ids = {e.scholarship.id for e in res.eligible}
        not_eligible_ids = {e.scholarship.id for e in res.not_eligible}
        potentially_ids = {e.scholarship.id for e in res.potentially_eligible}

        # B.Tech, 8.5 CGPA (~80.75%), 2.5L income, Maharashtra, General, Male
        assert "pm-usp-csss" in eligible_ids
        assert "ffe-engineering" in eligible_ids
        assert "reliance-foundation-ug" in eligible_ids
        assert "hdfc-parivartan-ecss" in eligible_ids
        assert "mahadbt-ebc-shahu" in eligible_ids
        assert "state-tech-univ-merit" in eligible_ids

        # Female-only or other-state or SC/ST schemes must be in not_eligible
        assert "aicte-pragati-degree" in not_eligible_ids
        assert "kotak-kanya" in not_eligible_ids
        assert "nsp-post-matric-sc" in not_eligible_ids
        assert "wb-svmcm" in not_eligible_ids

        # Special verification schemes with no hard failure go to potentially_eligible
        assert "aicte-swanath-degree" in potentially_ids


def test_eligibility_missing_profile_fields():
    init_db()
    with SessionLocal() as db:
        seed_database(db)
        profile = StudentProfile(course="B.Tech")
        res = check_eligibility(db, profile)
        assert len(res.eligible) == 0  # Every scheme requires income/score/category/gender/special check
        assert len(res.potentially_eligible) >= 15
        assert "family_income" in res.missing_profile_fields
        assert "state" in res.missing_profile_fields


def test_eligibility_high_income_rejection():
    init_db()
    with SessionLocal() as db:
        seed_database(db)
        profile = StudentProfile(
            education_level="UG",
            course="B.Tech",
            percentage=92.0,
            family_income=2000000,
            state="Delhi",
            category="General",
            gender="Female",
        )
        res = check_eligibility(db, profile)
        not_eligible_map = {e.scholarship.id: e for e in res.not_eligible}
        assert "ffe-engineering" in not_eligible_map
        assert any("exceeds maximum limit" in c for c in not_eligible_map["ffe-engineering"].unmet_conditions)
        assert "pm-usp-csss" in not_eligible_map
        # PMSS has no income cap -> potentially eligible (special CAPF condition)
        pot_ids = {e.scholarship.id for e in res.potentially_eligible}
        assert "pmss-capf-ar" in pot_ids
