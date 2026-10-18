from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.core.config import settings
from app.core.learning_profile_prompt import build_profile_section, with_profile_note
from app.core.prompts import SYSTEM_PROMPT
from app.schemas.learning_profile import LearningProfile

try:
    import google.generativeai as genai
except Exception:  # pragma: no cover - optional import guard
    genai = None

try:
    from google.api_core import exceptions as google_exceptions
except Exception:  # pragma: no cover - optional import guard
    google_exceptions = None

logger = logging.getLogger(__name__)


class GeminiConfigError(RuntimeError):
    """Gemini cannot be used because the key or the SDK is missing."""


class GeminiRequestError(RuntimeError):
    """The Gemini request failed or returned nothing usable."""


class GeminiTimeoutError(GeminiRequestError):
    """The Gemini request exceeded its deadline."""


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


def generate_chat_response(
    message: str, subject: str, user_name: str, learning_profile: LearningProfile | None = None
) -> dict[str, str]:
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
        model = genai.GenerativeModel(
            settings.gemini_model, system_instruction=with_profile_note(SYSTEM_PROMPT, learning_profile)
        )
        prompt = (
            f"Student name: {user_name}\n"
            f"Subject: {subject}\n"
            f"Question: {message}\n"
            "Respond as an engineering mentor."
            f"{build_profile_section(learning_profile)}"
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


def generate_text(
    prompt: str,
    *,
    system_instruction: str,
    json_output: bool = False,
    temperature: float = 0.7,
    timeout_seconds: float = 60.0,
    model_name: str | None = None,
    images: list[tuple[str, bytes]] | None = None,
) -> str:
    """Return raw model text for ``prompt`` using the shared key.

    ``images`` is an optional list of ``(mime_type, bytes)`` still images sent with the prompt (used by the camera
    feature). The bytes are passed straight to the provider and are not logged or kept.

    The model defaults to the ``GEMINI_MODEL`` setting; pass ``model_name`` to override it per feature.

    Unlike :func:`generate_chat_response` this raises instead of returning a fallback message, so
    callers (such as the quiz generator) can decide how to react.

    Raises:
        GeminiConfigError: the API key or the SDK is missing.
        GeminiTimeoutError: the request exceeded ``timeout_seconds``.
        GeminiRequestError: any other upstream failure, or an empty response.
    """
    if not settings.gemini_api_key:
        raise GeminiConfigError("GEMINI_API_KEY is not configured.")

    if genai is None:
        raise GeminiConfigError("The google-generativeai package is not installed.")

    generation_config: dict[str, object] = {"temperature": temperature}
    if json_output:
        generation_config["response_mime_type"] = "application/json"

    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(
            model_name or settings.gemini_model,
            system_instruction=system_instruction,
            generation_config=generation_config,
        )
        contents: object = prompt
        if images:
            contents = [prompt, *({"mime_type": mime, "data": data} for mime, data in images)]
        result = model.generate_content(contents, request_options={"timeout": timeout_seconds})
        text = getattr(result, "text", None)
    except Exception as exc:
        if google_exceptions is not None and isinstance(exc, google_exceptions.DeadlineExceeded):
            raise GeminiTimeoutError("Gemini request timed out.") from exc
        raise GeminiRequestError(f"Gemini request failed: {type(exc).__name__}") from exc

    if not text:
        raise GeminiRequestError("Gemini returned an empty response.")

    return text
