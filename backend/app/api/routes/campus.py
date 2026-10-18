from fastapi import APIRouter, HTTPException

from app.agents.base import AgentError
from app.agents.campus_assistant import run_campus
from app.agents.classroom_summarizer import run_summary
from app.schemas.campus import CampusAskRequest, CampusAskResponse, ClassroomSummaryRequest, ClassroomSummaryResponse

router = APIRouter(tags=["campus"])


@router.post("/campus/ask", response_model=CampusAskResponse, response_model_by_alias=True)
def ask(payload: CampusAskRequest) -> CampusAskResponse:
    """Answer a college question only from the supplied documents, with verified citations."""
    try:
        return run_campus(payload)
    except AgentError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.public_message) from exc


@router.post("/classroom/summary", response_model=ClassroomSummaryResponse, response_model_by_alias=True)
def summary(payload: ClassroomSummaryRequest) -> ClassroomSummaryResponse:
    """Summarise a local (single-user) classroom session and suggest revision questions."""
    try:
        return run_summary(payload)
    except AgentError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.public_message) from exc
