from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal, init_db
from app.knowledge_base.loader import (
    get_scholarship_knowledge_graph,
    seed_database,
    validate_dataset,
)
from app.models.entities import AdminUser, KnowledgeEdge, Scholarship
from app.rag.retriever import SearchFilters, hybrid_search
from app.rag.vector_store import get_vector_counts, index_all_scholarships


def test_phase1_health_endpoint():
    client = TestClient(app)
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["demo_mode"] is True


def test_phase2_schema_and_seed():
    dataset = validate_dataset()
    assert len(dataset["scholarships"]) >= 20

    init_db()
    with SessionLocal() as db:
        total = seed_database(db, force_update=True)
        assert total == len(dataset["scholarships"])
        assert db.query(Scholarship).count() >= 20
        assert db.query(KnowledgeEdge).count() > 50
        assert db.query(AdminUser).count() >= 1

        kg = get_scholarship_knowledge_graph(db, "pm-usp-csss")
        assert len(kg["nodes"]) > 3
        assert any(e.relation == "PROVIDED_BY" for e in kg["edges"])


def test_phase3_indexing_and_hybrid_search():
    init_db()
    with SessionLocal() as db:
        seed_database(db)
        indexed = index_all_scholarships(db, force_reindex=True)
        assert indexed >= 20

        counts = get_vector_counts()
        assert counts["scholarships_indexed"] == indexed

        res = hybrid_search(
            db,
            query="B.Tech student, 8.5 CGPA, family income below 3 lakh",
            filters=SearchFilters(course="B.Tech", max_income=300000),
            top_k=6,
        )
        assert len(res.results) >= 3
        assert res.confidence in ("High", "Medium", "Low")
        ids = {r.scholarship.id for r in res.results}
        # Expect key B.Tech + low-income scholarships in top results
        assert ids & {"ffe-engineering", "pm-usp-csss", "hdfc-parivartan-ecss", "reliance-foundation-ug", "state-tech-univ-merit"}
