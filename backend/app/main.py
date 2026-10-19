from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.core.config import settings

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/healthz")
async def healthz():
    """Cheap liveness check for Render and for a keep-alive ping. It never calls Gemini."""
    return {"status": "ok"}


@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "status": "ok",
        "phase": "Phase 1 MVP scaffold"
    }