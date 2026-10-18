from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.core.config import settings
from app.core.prompts import SYSTEM_PROMPT

try:
    import google.generativeai as genai
except Exception:  # pragma: no cover - optional import guard
    genai = None

logger = logging.getLogger(__name__)


def _build_fallback_response(subject: str, user_name: str, reason: str) -> str:
    """Return a friendly message shown when live AI is unavailable (the details stay in the server log)."""
    return (
        f"Hi {user_name}, I can help with {subject}, but the live AI service is unavailable right now "
        f"({reason}). Please try again in a moment."
    )


def _result(response: str, status: str) -> dict[str, str]:
    """Build the payload expected by ``ChatResponse``."""
    return {
        "response": response,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": status,
    }


def generate_chat_response(message: str, subject: str, user_name: str) -> dict[str, str]:
    """Generate a chat response from Gemini.

    Never raises: on any failure it returns ``status='error'`` with a friendly message so the API
    layer stays simple and the frontend can show its own error state.
    """
    if not settings.gemini_api_key:
        logger.error("GEMINI_API_KEY is not configured.")
        return _result(_build_fallback_response(subject, user_name, "the API key is not configured"), "error")

    if genai is None:
        logger.error("The google-generativeai package is not installed.")
        return _result(_build_fallback_response(subject, user_name, "the AI client is not installed"), "error")

    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.gemini_model, system_instruction=SYSTEM_PROMPT)
        prompt = (
            f"Student name: {user_name}\n"
            f"Subject: {subject}\n"
            f"Question: {message}\n"
            "Respond as an engineering mentor."
        )
        result = model.generate_content(prompt)
        text = getattr(result, "text", None)

        if not text:
            logger.warning("Gemini returned an empty response for subject=%s.", subject)
            return _result(_build_fallback_response(subject, user_name, "the AI returned an empty answer"), "error")

        return _result(text, "success")
    except Exception:
        logger.exception("Gemini request failed (model=%s).", settings.gemini_model)
        return _result(_build_fallback_response(subject, user_name, "the AI request failed"), "error")
