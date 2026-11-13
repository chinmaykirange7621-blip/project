from typing import Literal
from pydantic import BaseModel, Field
from app.schemas.eligibility import StudentProfile


IntentType = Literal[
    "discovery",
    "eligibility",
    "application_guidance",
    "documents",
    "deadlines",
    "general",
]

ConfidenceLevel = Literal["High", "Medium", "Low"]


class ChatMessageInput(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[ChatMessageInput] = Field(default_factory=list)
    profile_context: StudentProfile | None = None


class CitationSource(BaseModel):
    id: str
    name: str
    provider: str
    type: str
    basis: str
    official_url: str
    source_status: Literal["verified", "sample"]
    last_verified: str | None = None
    deadline: str | None = None
    amount: str | None = None
    relevance_score: float
    eligibility_status: Literal["eligible", "potentially_eligible", "not_eligible"] | None = None
    snippet: str | None = None


class AgentTraceStep(BaseModel):
    stage: str
    title: str
    detail: str


class AgentExplanationTrace(BaseModel):
    intent: IntentType
    extracted_entities: dict
    sources_used: list[str]
    provider_mode: str
    steps: list[AgentTraceStep]


class ChatResponse(BaseModel):
    answer: str
    intent: IntentType
    sources: list[CitationSource]
    eligibility_reasoning: str | None = None
    confidence: ConfidenceLevel
    limitations: list[str]
    follow_up_questions: list[str]
    extracted_profile: StudentProfile
    privacy_warnings: list[str] = Field(default_factory=list)
    disclaimer: str = "Final eligibility is decided by the provider."
    demo_mode: bool
    trace: AgentExplanationTrace
