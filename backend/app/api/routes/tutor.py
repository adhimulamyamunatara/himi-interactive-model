import logging

from fastapi import APIRouter, HTTPException

from app.agents.base import AgentError
from app.agents.orchestrator import run_tutor
from app.schemas.tutor import TutorRequest, TutorResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tutor", tags=["tutor"])


@router.post("/respond", response_model=TutorResponse, response_model_by_alias=True)
def respond(payload: TutorRequest) -> TutorResponse:
    """Run the multi-agent tutoring workflow for one student message.

    A plain ``def`` on purpose: the model calls block, so FastAPI runs this in a worker thread.
    Existing ``/api/chat`` is untouched; this endpoint is additive.
    """
    try:
        return run_tutor(payload)
    except AgentError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.public_message) from exc
