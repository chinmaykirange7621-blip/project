from fastapi.testclient import TestClient

from app.main import app


SUGGESTED_CHIPS = [
    "Am I eligible for a scholarship?",
    "What scholarships are available for B.Tech students?",
    "What documents are required for NSP scholarships?",
    "How do I apply for a merit-based scholarship?",
    "Find scholarships for students from low-income families.",
    "What is the last date to apply?",
]


def test_phase8_all_suggested_chips_and_multiturn_chat():
    with TestClient(app) as client:
        # Verify all 6 suggested chips produce grounded, valid responses
        for chip in SUGGESTED_CHIPS:
            resp = client.post("/api/chat", json={"message": chip})
            assert resp.status_code == 200, f"Chip failed: {chip} -> {resp.text}"
            data = resp.json()
            assert data["answer"]
            assert data["confidence"] in {"High", "Medium", "Low"}
            assert "Final eligibility is decided by the provider." in data["disclaimer"]
            assert isinstance(data["trace"]["steps"], list) and len(data["trace"]["steps"]) == 6

        # Test multi-turn follow-up flow: missing profile -> student provides profile details -> eligible matches
        turn1 = client.post("/api/chat", json={"message": "Am I eligible for a scholarship?"}).json()
        assert len(turn1["follow_up_questions"]) > 0

        turn2 = client.post(
            "/api/chat",
            json={
                "message": "I am studying B.Tech CSE, CGPA 8.5, family income 2.5 lakh, domicile Maharashtra",
                "history": [
                    {"role": "user", "content": "Am I eligible for a scholarship?"},
                    {"role": "assistant", "content": turn1["answer"]},
                ],
                "profile_context": turn1["extracted_profile"],
            },
        ).json()
        assert turn2["extracted_profile"]["course"] is not None
        assert turn2["extracted_profile"]["cgpa"] == 8.5
        assert turn2["extracted_profile"]["family_income"] == 250000
        assert len(turn2["sources"]) > 0
        assert any(src["eligibility_status"] == "eligible" for src in turn2["sources"])


def test_phase8_filters_sorting_and_error_handling():
    with TestClient(app) as client:
        # Pagination, sorting, and filtering
        res = client.get(
            "/api/scholarships",
            params={
                "type": "government",
                "course": "B.Tech",
                "max_income": 300000,
                "sort_by": "name",
                "sort_order": "asc",
                "page": 1,
                "page_size": 5,
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["total"] >= 1
        assert len(body["items"]) <= 5

        # 404 helpful error on nonexistent scholarship
        not_found = client.get("/api/scholarships/does-not-exist-999")
        assert not_found.status_code == 404
        assert "detail" in not_found.json()

        # 422 helpful validation error on invalid CGPA (>10)
        bad_elig = client.post(
            "/api/eligibility/check",
            json={"course": "B.Tech", "cgpa": 15.0},
        )
        assert bad_elig.status_code == 422
        assert bad_elig.json()["error"] == "Validation Error"


def test_render_deployment_readiness():
    from app.utils.config import Settings

    pg = Settings(database_url="postgres://user:pass@dpg-xyz.oregon-postgres.render.com/scholarai")
    assert pg.resolved_database_url == "postgresql://user:pass@dpg-xyz.oregon-postgres.render.com/scholarai"

    with TestClient(app) as client:
        # Built-in API docs & health stay reachable
        assert client.get("/api/health").status_code == 200
        assert client.get("/docs").status_code == 200

        # Unknown /api/* routes always return 404 JSON (never SPA HTML)
        api_404 = client.get("/api/nonexistent-endpoint")
        assert api_404.status_code == 404
        assert "detail" in api_404.json()

        # Root & deep SPA route respond cleanly (HTML when frontend/dist exists, JSON root otherwise)
        root_res = client.get("/")
        assert root_res.status_code == 200
        if "text/html" in root_res.headers.get("content-type", ""):
            chat_res = client.get("/chat")
            assert chat_res.status_code == 200
            assert "text/html" in chat_res.headers.get("content-type", "")
