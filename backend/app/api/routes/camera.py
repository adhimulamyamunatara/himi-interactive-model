import logging

from fastapi import APIRouter, HTTPException

from app.agents.base import AgentError
from app.agents.photo_helper import run_photo
from app.schemas.camera import CameraAnalyzeRequest, CameraAnalyzeResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/camera", tags=["camera"])


@router.post("/analyze", response_model=CameraAnalyzeResponse)
def analyze(payload: CameraAnalyzeRequest) -> CameraAnalyzeResponse:
    """Explain or transcribe one still photo of study material. The photo is used for this request only."""
    try:
        image = payload.image_bytes()
    except ValueError as exc:
        # The message is one of our own fixed validation messages and never echoes the data.
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        return run_photo(payload, image)
    except AgentError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.public_message) from exc
