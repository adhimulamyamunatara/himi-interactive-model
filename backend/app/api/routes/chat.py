from fastapi import APIRouter

from app.schemas.chat import ChatRequest, ChatResponse
from app.services.gemini_service import generate_chat_response

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def create_chat_response(payload: ChatRequest) -> ChatResponse:
    """Answer a student's question.

    Declared as a plain ``def`` on purpose: the Gemini call is blocking, so FastAPI runs it in a
    worker thread instead of freezing the event loop for other requests.
    """
    result = generate_chat_response(
        payload.message, payload.subject, payload.userName, learning_profile=payload.learningProfile
    )
    return ChatResponse(**result)
