import logging

from fastapi import APIRouter, HTTPException

from app.agents.base import AgentError
from app.agents.visual_explainer import run_diagram
from app.schemas.diagram import DiagramRequest, DiagramResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/diagrams", tags=["diagrams"])


@router.post("/generate", response_model=DiagramResponse, response_model_by_alias=True)
def generate(payload: DiagramRequest) -> DiagramResponse:
    """Generate a validated node/edge diagram (never markup) and a text explanation for a topic."""
    try:
        return run_diagram(payload)
    except AgentError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.public_message) from exc
