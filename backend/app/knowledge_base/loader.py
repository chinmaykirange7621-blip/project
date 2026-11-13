import json
import re
from pathlib import Path
import bcrypt
import jsonschema
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (
    AdminUser,
    Course,
    Document,
    KnowledgeEdge,
    Organization,
    Scholarship,
    State,
)
from app.utils.config import DATA_DIR, get_settings


SCHOLARSHIPS_JSON_PATH = DATA_DIR / "scholarships" / "scholarships.json"
SCHOLARSHIPS_SCHEMA_PATH = DATA_DIR / "scholarships" / "schema.json"


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:96] or "item"


def validate_dataset(
    data_path: Path = SCHOLARSHIPS_JSON_PATH,
    schema_path: Path = SCHOLARSHIPS_SCHEMA_PATH,
) -> dict:
    with data_path.open("r", encoding="utf-8") as f:
        dataset = json.load(f)
    with schema_path.open("r", encoding="utf-8") as f:
        schema = json.load(f)
    jsonschema.validate(instance=dataset, schema=schema)
    return dataset


def _get_or_create_organization(db: Session, name: str, org_type: str, official_url: str | None) -> Organization:
    org_id = slugify(name)
    org = db.get(Organization, org_id)
    if not org:
        org = db.scalar(select(Organization).where(Organization.name == name))
    if not org:
        org = Organization(id=org_id, name=name, org_type=org_type, official_url=official_url)
        db.add(org)
        db.flush()
    return org


def _get_or_create_course(db: Session, name: str, level: str = "UG") -> Course:
    cid = slugify(name)
    course = db.get(Course, cid)
    if not course:
        course = db.scalar(select(Course).where(Course.name == name))
    if not course:
        stream = "Engineering & Tech" if any(k in name.lower() for k in ("tech", "eng", "cse", "ai", "b.e")) else "General"
        course = Course(id=cid, name=name, level=level, stream=stream)
        db.add(course)
        db.flush()
    return course


def _get_or_create_state(db: Session, name: str) -> State:
    sid = slugify(name)
    state = db.get(State, sid)
    if not state:
        state = db.scalar(select(State).where(State.name == name))
    if not state:
        state = State(id=sid, name=name, region="National" if name == "All India" else "State/UT")
        db.add(state)
        db.flush()
    return state


def _get_or_create_document(db: Session, name: str) -> Document:
    did = slugify(name)
    doc = db.get(Document, did)
    if not doc:
        doc = db.scalar(select(Document).where(Document.name == name))
    if not doc:
        lower = name.lower()
        cat = "Financial" if "income" in lower or "bank" in lower or "itr" in lower else (
            "Academic" if "marksheet" in lower or "bonafide" in lower or "admission" in lower or "grade" in lower else "Identity/Category"
        )
        doc = Document(id=did, name=name, category=cat)
        db.add(doc)
        db.flush()
    return doc


def sync_knowledge_edges_for_scholarship(db: Session, scholarship: Scholarship) -> None:
    # Remove existing edges for this scholarship
    existing = db.scalars(
        select(KnowledgeEdge).where(
            KnowledgeEdge.source_type == "Scholarship",
            KnowledgeEdge.source_id == scholarship.id,
        )
    ).all()
    for edge in existing:
        db.delete(edge)

    # Organization node & edge
    org = _get_or_create_organization(db, scholarship.provider, scholarship.type, scholarship.official_url)
    scholarship.organization_id = org.id
    db.add(KnowledgeEdge(
        source_type="Scholarship",
        source_id=scholarship.id,
        relation="PROVIDED_BY",
        target_type="Organization",
        target_id=org.name,
        metadata_json={"org_type": scholarship.type},
    ))

    # Education levels
    for lvl in (scholarship.education_level or []):
        db.add(KnowledgeEdge(
            source_type="Scholarship",
            source_id=scholarship.id,
            relation="SUPPORTS_EDUCATION_LEVEL",
            target_type="EducationLevel",
            target_id=lvl,
        ))

    # Courses
    default_level = (scholarship.education_level or ["UG"])[0]
    for cname in (scholarship.course or []):
        c = _get_or_create_course(db, cname, default_level)
        db.add(KnowledgeEdge(
            source_type="Scholarship",
            source_id=scholarship.id,
            relation="SUPPORTS_COURSE",
            target_type="Course",
            target_id=c.name,
        ))

    # States
    for sname in (scholarship.states or []):
        st = _get_or_create_state(db, sname)
        db.add(KnowledgeEdge(
            source_type="Scholarship",
            source_id=scholarship.id,
            relation="VALID_IN_STATE",
            target_type="State",
            target_id=st.name,
        ))

    # Required documents
    for dname in (scholarship.required_documents or []):
        doc = _get_or_create_document(db, dname)
        db.add(KnowledgeEdge(
            source_type="Scholarship",
            source_id=scholarship.id,
            relation="REQUIRES_DOCUMENT",
            target_type="Document",
            target_id=doc.name,
            metadata_json={"category": doc.category},
        ))

    # Minimum score / income constraints
    if scholarship.min_percentage is not None:
        db.add(KnowledgeEdge(
            source_type="Scholarship",
            source_id=scholarship.id,
            relation="REQUIRES_MIN_SCORE",
            target_type="ScoreThreshold",
            target_id=f"Percentage >= {scholarship.min_percentage}%",
            metadata_json={"min_percentage": scholarship.min_percentage},
        ))
    if scholarship.min_cgpa is not None:
        db.add(KnowledgeEdge(
            source_type="Scholarship",
            source_id=scholarship.id,
            relation="REQUIRES_MIN_SCORE",
            target_type="ScoreThreshold",
            target_id=f"CGPA >= {scholarship.min_cgpa}",
            metadata_json={"min_cgpa": scholarship.min_cgpa},
        ))
    if scholarship.max_family_income is not None:
        db.add(KnowledgeEdge(
            source_type="Scholarship",
            source_id=scholarship.id,
            relation="HAS_INCOME_CAP",
            target_type="IncomeLimit",
            target_id=f"<= INR {int(scholarship.max_family_income):,}/year",
            metadata_json={"max_family_income": scholarship.max_family_income},
        ))


def ensure_default_admin(db: Session) -> AdminUser:
    settings = get_settings()
    admin = db.scalar(select(AdminUser).where(AdminUser.username == settings.admin_username))
    if not admin:
        pw_hash = bcrypt.hashpw(settings.admin_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        admin = AdminUser(username=settings.admin_username, password_hash=pw_hash, role="admin")
        db.add(admin)
        db.commit()
        db.refresh(admin)
    return admin


def seed_database(db: Session, force_update: bool = False) -> int:
    ensure_default_admin(db)
    existing_count = db.query(Scholarship).count()
    if existing_count > 0 and not force_update:
        return existing_count

    dataset = validate_dataset()
    count = 0
    for item in dataset.get("scholarships", []):
        existing = db.get(Scholarship, item["id"])
        if existing and not force_update:
            continue
        if existing:
            for key, val in item.items():
                if hasattr(existing, key):
                    setattr(existing, key, val)
            sch = existing
        else:
            sch = Scholarship(**item)
            db.add(sch)
        db.flush()
        sync_knowledge_edges_for_scholarship(db, sch)
        count += 1

    db.commit()
    return db.query(Scholarship).count()


def get_scholarship_knowledge_graph(db: Session, scholarship_id: str) -> dict:
    sch = db.get(Scholarship, scholarship_id)
    if not sch:
        return {"scholarship_id": scholarship_id, "nodes": [], "edges": []}

    edges = db.scalars(
        select(KnowledgeEdge).where(
            KnowledgeEdge.source_type == "Scholarship",
            KnowledgeEdge.source_id == scholarship_id,
        )
    ).all()

    nodes = [{"id": sch.id, "type": "Scholarship", "label": sch.name}]
    seen = {("Scholarship", sch.id)}
    for edge in edges:
        key = (edge.target_type, edge.target_id)
        if key not in seen:
            seen.add(key)
            nodes.append({"id": edge.target_id, "type": edge.target_type, "label": edge.target_id})

    return {
        "scholarship_id": scholarship_id,
        "nodes": nodes,
        "edges": edges,
    }
