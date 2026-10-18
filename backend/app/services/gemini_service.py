from __future__ import annotations
from datetime import datetime, timezone
import os
from app.core.config import settings
from app.core.prompts import SYSTEM_PROMPT

try:
    import google.generativeai as genai
except Exception:  # pragma: no cover - optional import guard
    genai = None


def _build_fallback_response(subject: str, message: str, user_name: str, reason: str | None = None) -> str:
    support_hint = "Please verify GEMINI_API_KEY, model access, and quota/billing in Google AI Studio."
    if reason:
        support_hint = f"{support_hint} Details: {reason}"

    return (
        f"Hi {user_name}, I can help with {subject}. "
        f"I received your message: '{message}'. "
        f"Live AI response is currently unavailable. {support_hint}"
    )


def generate_chat_response(message: str, subject: str, user_name: str) -> dict[str, str]:
    """Generate a chat response from Gemini or return a friendly fallback."""
    timestamp = datetime.now(timezone.utc).isoformat()

    api_key = settings.gemini_api_key



    if not api_key:
        return {
            'response': _build_fallback_response(subject, message, user_name, 'GEMINI_API_KEY is missing.'),
            'timestamp': timestamp,
            'status': 'error'
        }

    if genai is None:
        return {
            'response': _build_fallback_response(subject, message, user_name, 'google-generativeai package is not available.'),
            'timestamp': timestamp,
            'status': 'error'
        }

    try:
        genai.configure(api_key=api_key)
        model_name = os.getenv('GEMINI_MODEL', 'gemini-2.0-flash')
        model = genai.GenerativeModel(model_name, system_instruction=SYSTEM_PROMPT)
        prompt = (
            f"Student name: {user_name}\n"
            f"Subject: {subject}\n"
            f"Question: {message}\n"
            "Respond as an engineering mentor."
        )
        result = model.generate_content(prompt)
        text = getattr(result, 'text', None) or _build_fallback_response(subject, message, user_name)

        return {
            'response': text,
            'timestamp': timestamp,
            'status': 'success'
        }
    except Exception as exc:
        return {
            'response': _build_fallback_response(subject, message, user_name, str(exc)),
            'timestamp': timestamp,
            'status': 'error'
        }