from datetime import datetime, timezone
from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.session import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), unique=True, nullable=False)
    org_type: Mapped[str] = mapped_column(String(64), nullable=False)
    official_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    scholarships: Mapped[list["Scholarship"]] = relationship(back_populates="organization")


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    level: Mapped[str] = mapped_column(String(64), default="UG")
    stream: Mapped[str] = mapped_column(String(128), default="General")


class State(Base):
    __tablename__ = "states"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    region: Mapped[str] = mapped_column(String(64), default="India")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="Verification")


class Scholarship(Base):
    __tablename__ = "scholarships"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(256), nullable=False)
    organization_id: Mapped[str | None] = mapped_column(
        String(128), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True
    )
    type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)  # government/private/university
    basis: Mapped[str] = mapped_column(String(32), nullable=False, index=True)  # merit/need/category
    education_level: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    course: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    min_percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_cgpa: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_family_income: Mapped[float | None] = mapped_column(Float, nullable=True)
    states: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    categories: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    amount: Mapped[str | None] = mapped_column(String(300), nullable=True)
    required_documents: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    deadline: Mapped[str | None] = mapped_column(String(64), nullable=True)
    official_url: Mapped[str] = mapped_column(String(512), nullable=False)
    source_status: Mapped[str] = mapped_column(String(32), nullable=False, default="sample", index=True)
    last_verified: Mapped[str | None] = mapped_column(String(32), nullable=True)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    eligibility_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    application_steps: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    gender_requirement: Mapped[str | None] = mapped_column(String(32), nullable=True, default="All")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    organization: Mapped[Organization | None] = relationship(back_populates="scholarships")


class KnowledgeEdge(Base):
    __tablename__ = "knowledge_edges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    relation: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    target_id: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class IngestedDocument(Base):
    __tablename__ = "ingested_documents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    filename: Mapped[str] = mapped_column(String(256), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(256), nullable=False)
    scholarship_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    char_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    uploaded_by: Mapped[str] = mapped_column(String(128), nullable=False, default="admin")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class SearchLog(Base):
    __tablename__ = "search_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    query: Mapped[str] = mapped_column(String(500), nullable=False)
    endpoint: Mapped[str] = mapped_column(String(64), nullable=False)
    intent: Mapped[str | None] = mapped_column(String(64), nullable=True)
    result_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_failed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="admin")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
