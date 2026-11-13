from fastapi.testclient import TestClient
from app.main import app
from app.utils.config import get_settings


def _minimal_pdf_bytes(text: str = "ScholarAI AICTE Pragati BTech Technical Degree Circular") -> bytes:
    # Minimal valid PDF 1.4 containing selectable text
    stream_data = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET"
    objects = [
        "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
        "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
        "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
        f"4 0 obj << /Length {len(stream_data)} >> stream\n{stream_data}\nendstream endobj\n",
        "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    ]
    header = "%PDF-1.4\n"
    offsets = []
    body = ""
    pos = len(header)
    for obj in objects:
        offsets.append(pos)
        body += obj
        pos += len(obj)
    xref_pos = pos
    xref = f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n"
    for off in offsets:
        xref += f"{off:010d} 00000 n \n"
    trailer = f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n"
    return (header + body + xref + trailer).encode("ascii")


def test_phase6_docs_and_public_endpoints():
    with TestClient(app) as client:
        assert client.get("/docs").status_code == 200
        stats = client.get("/api/stats")
        assert stats.status_code == 200
        assert stats.json()["total_scholarships"] >= 20

        lst = client.get("/api/scholarships?type=government&page=1&page_size=5")
        assert lst.status_code == 200
        assert len(lst.json()["items"]) == 5

        detail = client.get("/api/scholarships/pm-usp-csss")
        assert detail.status_code == 200
        assert detail.json()["knowledge_graph"]["nodes"]

        missing = client.get("/api/scholarships/does-not-exist")
        assert missing.status_code == 404
        assert "detail" in missing.json()

        search = client.get("/api/search?q=B.Tech+8.5+CGPA+income+below+3+lakh")
        assert search.status_code == 200
        assert search.json()["total"] >= 1

        # Trigger a failed search for analytics tracking
        failed_search = client.get("/api/search?q=xyznonexistentquantumgrant999")
        assert failed_search.status_code == 200
        assert failed_search.json()["total"] == 0

        elig = client.post(
            "/api/eligibility/check",
            json={"course": "B.Tech", "cgpa": 8.5, "family_income": 250000, "state": "Maharashtra", "category": "General", "gender": "Female"},
        )
        assert elig.status_code == 200
        assert elig.json()["summary"]["eligible_count"] >= 1

        # Validation error check
        bad = client.post("/api/eligibility/check", json={"cgpa": 15.0})
        assert bad.status_code == 422
        assert bad.json()["error"] == "Validation Error"


def test_phase6_admin_auth_crud_and_pdf_ingestion():
    settings = get_settings()
    with TestClient(app) as client:
        # Unauthorized check
        unauth = client.get("/api/admin/analytics")
        assert unauth.status_code == 401

        bad_login = client.post(
            "/api/admin/login",
            json={"username": settings.admin_username, "password": "wrong-password"},
        )
        assert bad_login.status_code == 401

        login = client.post(
            "/api/admin/login",
            json={"username": settings.admin_username, "password": settings.admin_password},
        )
        assert login.status_code == 200
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        me = client.get("/api/admin/me", headers=headers)
        assert me.status_code == 200
        assert me.json()["username"] == settings.admin_username

        # Create scholarship and verify search reflects it immediately
        new_sch = {
            "id": "test-quantum-ai-grant",
            "name": "Quantum AI Innovation Fellowship India",
            "provider": "Quantum India Research Foundation",
            "type": "private",
            "basis": "merit",
            "education_level": ["UG"],
            "course": ["B.Tech", "AI&ML", "CSE"],
            "min_percentage": None,
            "min_cgpa": 8.0,
            "max_family_income": 500000,
            "states": ["All India"],
            "categories": ["All"],
            "amount": "₹1,00,000 per year",
            "required_documents": ["College Bonafide", "Semester Grade Card"],
            "deadline": None,
            "official_url": "https://example.org/quantum-ai-grant",
            "source_status": "sample",
            "last_verified": None,
            "description": "Test grant for B.Tech AI&ML innovators.",
            "gender_requirement": "All",
            "is_active": True,
        }
        created = client.post("/api/admin/scholarships", json=new_sch, headers=headers)
        assert created.status_code == 201

        search_new = client.get("/api/search?q=Quantum+AI+Innovation+Fellowship")
        assert search_new.status_code == 200
        found_ids = [hit["scholarship"]["id"] for hit in search_new.json()["results"]]
        assert "test-quantum-ai-grant" in found_ids

        # Update scholarship verification status
        updated = client.put(
            "/api/admin/scholarships/test-quantum-ai-grant",
            json={"source_status": "verified", "amount": "₹1,20,000 per year"},
            headers=headers,
        )
        assert updated.status_code == 200
        assert updated.json()["source_status"] == "verified"
        assert updated.json()["last_verified"] is not None

        # PDF ingestion upload + search + delete
        pdf_bytes = _minimal_pdf_bytes("Quantum AI Fellowship official circular requires semester transcript")
        upload = client.post(
            "/api/admin/documents/upload",
            headers=headers,
            data={"scholarship_id": "test-quantum-ai-grant"},
            files={"file": ("quantum_circular.pdf", pdf_bytes, "application/pdf")},
        )
        assert upload.status_code == 201
        doc_id = upload.json()["id"]
        assert upload.json()["chunk_count"] >= 1

        docs_list = client.get("/api/admin/documents", headers=headers)
        assert any(d["id"] == doc_id for d in docs_list.json())

        del_doc = client.delete(f"/api/admin/documents/{doc_id}", headers=headers)
        assert del_doc.status_code == 200

        # Delete scholarship and verify removed from search
        deleted = client.delete("/api/admin/scholarships/test-quantum-ai-grant", headers=headers)
        assert deleted.status_code == 200
        assert client.get("/api/scholarships/test-quantum-ai-grant").status_code == 404

        analytics = client.get("/api/admin/analytics", headers=headers)
        assert analytics.status_code == 200
        assert analytics.json()["total_searches"] >= 1
        assert analytics.json()["failed_searches_count"] >= 1
