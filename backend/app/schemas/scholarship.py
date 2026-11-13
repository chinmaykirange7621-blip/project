from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator


ScholarshipType = Literal["government", "private", "university"]
ScholarshipBasis = Literal["merit", "need", "category"]
SourceStatus = Literal["verified", "sample"]
GenderReq = Literal["All", "Female", "Male"]


class ScholarshipBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=300)
    provider: str = Field(..., min_length=2, max_length=256)
    type: ScholarshipType
    basis: ScholarshipBasis
    education_level: list[str] = Field(..., min_length=1)
    course: list[str] = Field(..., min_length=1)
    min_percentage: float | None = Field(default=None, ge=0, le=100)
    min_cgpa: float | None = Field(default=None, ge=0, le=10)
    max_family_income: float | None = Field(default=None, ge=0)
    states: list[str] = Field(..., min_length=1)
    categories: list[str] = Field(..., min_length=1)
    amount: str | None = Field(default=None, max_length=300)
    required_documents: list[str] = Field(default_factory=list)
    deadline: str | None = Field(default=None, max_length=64)
    official_url: str = Field(..., min_length=8, max_length=512)
    source_status: SourceStatus = "sample"
    last_verified: str | None = Field(default=None, max_length=32)
    description: str | None = None
    eligibility_notes: str | None = None
    application_steps: list[str] = Field(default_factory=list)
    gender_requirement: GenderReq | None = "All"
    is_active: bool = True

    @field_validator("official_url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        if not (v.startswith("https://") or v.startswith("http://")):
            raise ValueError("official_url must start with http:// or https://")
        return v


class ScholarshipCreate(ScholarshipBase):
    id: str | None = Field(default=None, pattern=r"^[a-z0-9-]+$", min_length=3, max_length=128)


class ScholarshipUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=300)
    provider: str | None = Field(default=None, min_length=2, max_length=256)
    type: ScholarshipType | None = None
    basis: ScholarshipBasis | None = None
    education_level: list[str] | None = None
    course: list[str] | None = None
    min_percentage: float | None = Field(default=None, ge=0, le=100)
    min_cgpa: float | None = Field(default=None, ge=0, le=10)
    max_family_income: float | None = Field(default=None, ge=0)
    states: list[str] | None = None
    categories: list[str] | None = None
    amount: str | None = None
    required_documents: list[str] | None = None
    deadline: str | None = None
    official_url: str | None = None
    source_status: SourceStatus | None = None
    last_verified: str | None = None
    description: str | None = None
    eligibility_notes: str | None = None
    application_steps: list[str] | None = None
    gender_requirement: GenderReq | None = None
    is_active: bool | None = None


class ScholarshipOut(ScholarshipBase):
    id: str
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class ScholarshipListResponse(BaseModel):
    items: list[ScholarshipOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class KnowledgeEdgeOut(BaseModel):
    source_type: str
    source_id: str
    relation: str
    target_type: str
    target_id: str
    metadata_json: dict | None = None

    model_config = {"from_attributes": True}


class KnowledgeGraphResponse(BaseModel):
    scholarship_id: str
    nodes: list[dict]
    edges: list[KnowledgeEdgeOut]


class StatsResponse(BaseModel):
    total_scholarships: int
    verified_count: int
    sample_count: int
    government_count: int
    private_count: int
    university_count: int
    states_covered: int
    demo_mode: bool
