from fastapi import APIRouter

from app.api.routes.chat import router as chat_router
from app.api.routes.notes import router as notes_router
from app.api.routes.quiz import router as quiz_router
from app.api.routes.study_planner import router as study_planner_router
from app.api.routes.tutor import router as tutor_router

api_router = APIRouter(prefix='/api')
api_router.include_router(chat_router)
api_router.include_router(quiz_router)
api_router.include_router(study_planner_router)
api_router.include_router(notes_router)
api_router.include_router(tutor_router)
