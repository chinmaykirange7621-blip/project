from fastapi.testclient import TestClient
from app.main import app


def test_phase5_btech_query_and_trace():
    with TestClient(app) as client:
        resp = client.post(
            "/api/chat",
            json={"message": "B.Tech student, 8.5 CGPA, family income below 3 lakh"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["demo_mode"] is True
        assert data["confidence"] in ("High", "Medium", "Low")
        assert data["disclaimer"] == "Final eligibility is decided by the provider."
        assert len(data["sources"]) >= 3
        assert data["extracted_profile"]["course"] == "B.Tech"
        assert data["extracted_profile"]["cgpa"] == 8.5
        assert data["extracted_profile"]["family_income"] == 300000
        assert len(data["trace"]["steps"]) >= 5
        assert "Final eligibility is decided by the provider." in data["answer"]


def test_phase5_missing_info_followups():
    with TestClient(app) as client:
        resp = client.post(
            "/api/chat",
            json={"message": "Am I eligible for a scholarship?"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] == "eligibility"
        assert len(data["follow_up_questions"]) >= 1
        assert len(data["limitations"]) >= 1
        assert "please share" in data["answer"].lower() or "missing" in data["eligibility_reasoning"].lower()


def test_phase5_pii_scrubbing():
    with TestClient(app) as client:
        resp = client.post(
            "/api/chat",
            json={
                "message": "My Aadhaar is 1234 5678 9012 and phone is 9876543210, find B.Tech scholarships"
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["privacy_warnings"]) >= 1
        assert "1234 5678 9012" not in data["answer"]


def test_phase5_documents_and_deadlines_intents():
    with TestClient(app) as client:
        r_docs = client.post(
            "/api/chat",
            json={"message": "What documents are required for NSP scholarships?"},
        )
        assert r_docs.status_code == 200
        assert r_docs.json()["intent"] == "documents"

        r_dead = client.post(
            "/api/chat",
            json={"message": "What is the last date to apply?"},
        )
        assert r_dead.status_code == 200
        assert r_dead.json()["intent"] == "deadlines"
        assert "information not available" in r_dead.json()["answer"].lower()
