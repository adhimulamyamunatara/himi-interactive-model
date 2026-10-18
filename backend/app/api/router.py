from fastapi import APIRouter

from app.api.routes.chat import router as chat_router
from app.api.routes.quiz import router as quiz_router

api_router = APIRouter(prefix='/api')
api_router.include_router(chat_router)
api_router.include_router(quiz_router)
