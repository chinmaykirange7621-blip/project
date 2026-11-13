from datetime import datetime
from pydantic import BaseModel, Field


class AdminLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=1, max_length=256)


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


class AdminMeResponse(BaseModel):
    username: str
    role: str


class IngestedDocumentOut(BaseModel):
    id: str
    filename: str
    original_filename: str
    scholarship_id: str | None = None
    chunk_count: int
    char_count: int
    uploaded_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FailedSearchOut(BaseModel):
    id: int
    query: str
    endpoint: str
    intent: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AnalyticsResponse(BaseModel):
    total_scholarships: int
    verified_count: int
    sample_count: int
    total_searches: int
    total_chats: int
    total_eligibility_checks: int
    failed_searches_count: int
    recent_failed_searches: list[FailedSearchOut]
    intent_breakdown: dict[str, int]
    type_breakdown: dict[str, int]
    vector_counts: dict
    ingested_documents_count: int
