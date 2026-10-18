from fastapi import APIRouter
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.gemini_service import generate_chat_response
router = APIRouter(prefix='/chat', tags=['chat'])
@router.post('', response_model=ChatResponse)
async def create_chat_response(payload: ChatRequest) -> ChatResponse:
    result = generate_chat_response(payload.message, payload.subject, payload.userName)
    return ChatResponse(**result)