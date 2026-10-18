import logging

from fastapi import APIRouter, HTTPException

from app.agents.base import AgentError
from app.agents.coding_assistant import run_code_assist
from app.schemas.code import CodeAssistRequest, CodeAssistResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/code", tags=["code"])


@router.post("/assist", response_model=CodeAssistResponse, response_model_by_alias=True)
def assist(payload: CodeAssistRequest) -> CodeAssistResponse:
    """Analyse submitted code (explain, debug, hints, complexity or test ideas).

    The code is only read by the model. It is never executed, compiled, saved or logged.
    """
    try:
        return run_code_assist(payload)
    except AgentError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.public_message) from exc
