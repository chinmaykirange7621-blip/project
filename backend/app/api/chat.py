from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agents.rational_agent import run_rational_agent
from app.database.session import get_db
from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter(prefix="/api", tags=["Chat & AI Agent"])


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(payload: ChatRequest, db: Session = Depends(get_db)):
    return run_rational_agent(db=db, request=payload)
