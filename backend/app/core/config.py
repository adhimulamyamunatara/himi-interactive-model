import os
from dataclasses import dataclass, field

from dotenv import load_dotenv


load_dotenv()


def _split_origins(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(slots=True)
class Settings:
    app_name: str = field(default_factory=lambda: os.getenv("APP_NAME", "HIMI"))
    app_env: str = field(default_factory=lambda: os.getenv("APP_ENV", "development"))
    app_host: str = field(default_factory=lambda: os.getenv("APP_HOST", "0.0.0.0"))
    app_port: int = field(default_factory=lambda: int(os.getenv("APP_PORT", "8000")))
    allowed_origins: list[str] = field(
        default_factory=lambda: _split_origins(os.getenv("ALLOWED_ORIGINS", "http://localhost:5173"))
    )
    gemini_api_key: str = field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    gemini_model: str = field(default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-3.8-flash"))
    # Optional: a faster model for quiz generation. Falls back to GEMINI_MODEL when unset.
    gemini_quiz_model: str = field(
        default_factory=lambda: os.getenv("GEMINI_QUIZ_MODEL") or os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    )
    # Optional: a faster model for the study planner. Falls back to GEMINI_MODEL when unset.
    gemini_planner_model: str = field(
        default_factory=lambda: os.getenv("GEMINI_PLANNER_MODEL") or os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    )
    # Optional: a faster model for notes summaries. Falls back to GEMINI_MODEL when unset.
    gemini_notes_model: str = field(
        default_factory=lambda: os.getenv("GEMINI_NOTES_MODEL") or os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    )
    # Optional: a model for the tutor agents. Falls back to GEMINI_MODEL when unset.
    gemini_tutor_model: str = field(
        default_factory=lambda: os.getenv("GEMINI_TUTOR_MODEL") or os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    )

 
settings = Settings()