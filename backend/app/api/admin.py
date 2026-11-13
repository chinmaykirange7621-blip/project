import io
import uuid
from datetime import date
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pypdf import PdfReader
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.knowledge_base.loader import slugify, sync_knowledge_edges_for_scholarship
from app.models.entities import (
    AdminUser,
    IngestedDocument,
    KnowledgeEdge,
    Scholarship,
    SearchLog,
)
from app.rag.vector_store import (
    delete_pdf_chunks,
    delete_scholarship_vector,
    get_vector_counts,
    index_pdf_chunks,
    upsert_scholarship_vector,
)
from app.schemas.admin import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminMeResponse,
    AnalyticsResponse,
    FailedSearchOut,
    IngestedDocumentOut,
)
from app.schemas.scholarship import ScholarshipCreate, ScholarshipOut, ScholarshipUpdate
from app.utils.auth import create_access_token, get_current_admin, verify_password
from app.utils.config import DATA_DIR

router = APIRouter(prefix="/api/admin", tags=["Admin"])

MAX_PDF_BYTES = 15 * 1024 * 1024  # 15 MB


def _chunk_text(text: str, chunk_size: int = 900, overlap: int = 150) -> list[str]:
    clean = " ".join(text.split())
    if not clean:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(clean):
        end = min(len(clean), start + chunk_size)
        chunks.append(clean[start:end])
        if end == len(clean):
            break
        start = max(0, end - overlap)
    return chunks


@router.post("/login", response_model=AdminLoginResponse)
def admin_login(payload: AdminLoginRequest, db: Session = Depends(get_db)):
    admin = db.scalar(select(AdminUser).where(AdminUser.username == payload.username))
    if not admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin username or password.",
        )
    token = create_access_token(username=admin.username, role=admin.role)
    return AdminLoginResponse(
        access_token=token,
        username=admin.username,
        role=admin.role,
    )


@router.get("/me", response_model=AdminMeResponse)
def admin_me(current_admin: AdminUser = Depends(get_current_admin)):
    return AdminMeResponse(username=current_admin.username, role=current_admin.role)


@router.post("/scholarships", response_model=ScholarshipOut, status_code=status.HTTP_201_CREATED)
def create_scholarship(
    payload: ScholarshipCreate,
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(get_current_admin),
):
    sch_id = payload.id or slugify(payload.name)
    # Ensure uniqueness if auto-slugified
    if db.get(Scholarship, sch_id):
        if payload.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Scholarship with id '{sch_id}' already exists.",
            )
        sch_id = f"{sch_id[:85]}-{uuid.uuid4().hex[:6]}"

    data = payload.model_dump(exclude={"id"})
    if data.get("source_status") == "verified" and not data.get("last_verified"):
        data["last_verified"] = date.today().isoformat()

    sch = Scholarship(id=sch_id, **data)
    db.add(sch)
    db.flush()
    sync_knowledge_edges_for_scholarship(db, sch)
    db.commit()
    db.refresh(sch)

    upsert_scholarship_vector(sch)
    return ScholarshipOut.model_validate(sch)


@router.put("/scholarships/{scholarship_id}", response_model=ScholarshipOut)
def update_scholarship(
    scholarship_id: str,
    payload: ScholarshipUpdate,
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(get_current_admin),
):
    sch = db.get(Scholarship, scholarship_id)
    if not sch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scholarship '{scholarship_id}' not found.",
        )

    updates = payload.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(sch, k, v)

    if updates.get("source_status") == "verified" and not sch.last_verified:
        sch.last_verified = date.today().isoformat()

    db.flush()
    sync_knowledge_edges_for_scholarship(db, sch)
    db.commit()
    db.refresh(sch)

    upsert_scholarship_vector(sch)
    return ScholarshipOut.model_validate(sch)


@router.delete("/scholarships/{scholarship_id}")
def delete_scholarship(
    scholarship_id: str,
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(get_current_admin),
):
    sch = db.get(Scholarship, scholarship_id)
    if not sch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scholarship '{scholarship_id}' not found.",
        )

    edges = db.scalars(
        select(KnowledgeEdge).where(
            KnowledgeEdge.source_type == "Scholarship",
            KnowledgeEdge.source_id == scholarship_id,
        )
    ).all()
    for e in edges:
        db.delete(e)

    db.delete(sch)
    db.commit()
    delete_scholarship_vector(scholarship_id)
    return {"deleted": True, "id": scholarship_id}


@router.post("/documents/upload", response_model=IngestedDocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_pdf_document(
    file: UploadFile = File(...),
    scholarship_id: str | None = Form(default=None),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    orig_name = file.filename or "document.pdf"
    if not orig_name.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF (.pdf) files are supported for ingestion.",
        )

    if scholarship_id:
        scholarship_id = scholarship_id.strip() or None
        if scholarship_id and not db.get(Scholarship, scholarship_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Linked scholarship '{scholarship_id}' not found.",
            )

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded PDF is empty.")
    if len(raw_bytes) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="PDF file exceeds 15 MB limit.",
        )

    try:
        reader = PdfReader(io.BytesIO(raw_bytes))
        pages_text = [(page.extract_text() or "") for page in reader.pages]
        full_text = "\n".join(pages_text).strip()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not parse PDF file: {exc}",
        )

    if not full_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No selectable text could be extracted from this PDF (it may be an image-only scan).",
        )

    doc_id = uuid.uuid4().hex[:16]
    docs_dir = DATA_DIR / "documents"
    docs_dir.mkdir(parents=True, exist_ok=True)
    stored_filename = f"{doc_id}_{slugify(orig_name.rsplit('.', 1)[0])}.pdf"
    (docs_dir / stored_filename).write_bytes(raw_bytes)

    chunks = _chunk_text(full_text)
    chunk_count = index_pdf_chunks(
        doc_id=doc_id,
        filename=orig_name,
        scholarship_id=scholarship_id,
        chunks=chunks,
    )

    record = IngestedDocument(
        id=doc_id,
        filename=stored_filename,
        original_filename=orig_name,
        scholarship_id=scholarship_id,
        chunk_count=chunk_count,
        char_count=len(full_text),
        uploaded_by=admin.username,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return IngestedDocumentOut.model_validate(record)


@router.get("/documents", response_model=list[IngestedDocumentOut])
def list_ingested_documents(
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(get_current_admin),
):
    docs = db.scalars(select(IngestedDocument).order_by(desc(IngestedDocument.created_at))).all()
    return [IngestedDocumentOut.model_validate(d) for d in docs]


@router.delete("/documents/{doc_id}")
def delete_ingested_document(
    doc_id: str,
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(get_current_admin),
):
    doc = db.get(IngestedDocument, doc_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{doc_id}' not found.",
        )

    file_path = DATA_DIR / "documents" / doc.filename
    if file_path.exists():
        file_path.unlink(missing_ok=True)

    db.delete(doc)
    db.commit()
    delete_pdf_chunks(doc_id)
    return {"deleted": True, "id": doc_id}


@router.get("/analytics", response_model=AnalyticsResponse)
def get_admin_analytics(
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(get_current_admin),
):
    scholarships = db.scalars(select(Scholarship)).all()
    logs = db.scalars(select(SearchLog).order_by(desc(SearchLog.created_at))).all()
    docs_count = db.query(IngestedDocument).count()

    intent_counts: dict[str, int] = {}
    for lg in logs:
        if lg.intent:
            intent_counts[lg.intent] = intent_counts.get(lg.intent, 0) + 1

    type_counts: dict[str, int] = {}
    for s in scholarships:
        type_counts[s.type] = type_counts.get(s.type, 0) + 1

    failed_logs = [lg for lg in logs if lg.is_failed]

    return AnalyticsResponse(
        total_scholarships=len(scholarships),
        verified_count=sum(1 for s in scholarships if s.source_status == "verified"),
        sample_count=sum(1 for s in scholarships if s.source_status == "sample"),
        total_searches=sum(1 for lg in logs if lg.endpoint == "/api/search"),
        total_chats=sum(1 for lg in logs if lg.endpoint == "/api/chat"),
        total_eligibility_checks=sum(1 for lg in logs if lg.endpoint == "/api/eligibility/check"),
        failed_searches_count=len(failed_logs),
        recent_failed_searches=[FailedSearchOut.model_validate(f) for f in failed_logs[:15]],
        intent_breakdown=intent_counts,
        type_breakdown=type_counts,
        vector_counts=get_vector_counts(),
        ingested_documents_count=docs_count,
    )
