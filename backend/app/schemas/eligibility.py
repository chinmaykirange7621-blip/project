from typing import Literal
from pydantic import BaseModel, Field
from app.schemas.scholarship import ScholarshipOut


class StudentProfile(BaseModel):
    """Non-identifying student eligibility profile. Zero PII."""

    education_level: str | None = Field(default=None, description="e.g. UG, PG, Diploma, Class 11-12, PhD")
    course: str | None = Field(default=None, description="e.g. B.Tech, CSE, AI&ML, B.Sc")
    percentage: float | None = Field(default=None, ge=0, le=100)
    cgpa: float | None = Field(default=None, ge=0, le=10)
    family_income: float | None = Field(default=None, ge=0, description="Annual family income in INR")
    state: str | None = Field(default=None, description="Domicile state or UT")
    category: str | None = Field(default=None, description="General, OBC, SC, ST, EWS, Minority, PwD")
    gender: str | None = Field(default=None, description="Female, Male, Other")


class EligibilityEvaluation(BaseModel):
    scholarship: ScholarshipOut
    status: Literal["eligible", "potentially_eligible", "not_eligible"]
    met_conditions: list[str]
    unmet_conditions: list[str]
    missing_requirements: list[str]
    notes: list[str] = Field(default_factory=list)


class EligibilityCheckResponse(BaseModel):
    profile: StudentProfile
    eligible: list[EligibilityEvaluation]
    potentially_eligible: list[EligibilityEvaluation]
    not_eligible: list[EligibilityEvaluation]
    summary: dict
    missing_profile_fields: list[str]
    disclaimer: str = "Final eligibility is decided by the provider."
