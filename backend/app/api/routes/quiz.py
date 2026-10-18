from fastapi import APIRouter, HTTPException

from app.schemas.quiz import QuizGenerateRequest, QuizGenerateResponse
from app.services.quiz_service import QuizServiceError, generate_quiz

router = APIRouter(prefix="/quiz", tags=["quiz"])


@router.post("/generate", response_model=QuizGenerateResponse)
def generate_quiz_endpoint(payload: QuizGenerateRequest) -> QuizGenerateResponse:
    """Generate a quiz for the chosen subject, topic, difficulty and size.

    A plain ``def`` on purpose: the Gemini call blocks, so FastAPI runs it in a worker thread.
    Failures are returned as ``{"detail": "<friendly message>"}`` with a 5xx status; internal
    details are logged server-side only.
    """
    try:
        quiz = generate_quiz(payload)
    except QuizServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.public_message) from exc

    return QuizGenerateResponse(quiz=quiz)
