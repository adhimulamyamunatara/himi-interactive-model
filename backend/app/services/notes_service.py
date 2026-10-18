"""Notes summarisation: build the prompt, call Gemini, and validate the (untrusted) output.

The notes text is never logged. It is only sent to Gemini when the student asks for a summary.
"""

from __future__ import annotations

import json
import logging

from pydantic import ValidationError

from app.core.config import settings
from app.core.learning_profile_prompt import build_profile_section, with_profile_note
from app.core.notes_prompts import NOTES_SYSTEM_PROMPT, NOTES_USER_PROMPT_TEMPLATE
from app.schemas.notes import NotesSummarizeRequest, NotesSummary
from app.services.gemini_service import GeminiConfigError, GeminiRequestError, GeminiTimeoutError, generate_text
from app.services.quiz_service import QuizValidationError, parse_quiz_json

logger = logging.getLogger(__name__)

MAX_GENERATION_ATTEMPTS = 2
GEMINI_TIMEOUT_SECONDS = 90.0


class NotesServiceError(Exception):
    """Base class for errors the API layer turns into HTTP responses."""

    status_code = 500
    public_message = "Summarising failed. Please try again."


class NotesServiceUnavailableError(NotesServiceError):
    status_code = 503
    public_message = "The summarising service is not available right now. Please try again later."


class NotesGenerationError(NotesServiceError):
    status_code = 502
    public_message = "HIMI couldn't produce a valid summary this time. Please try again."


class NotesTimeoutError(NotesServiceError):
    status_code = 504
    public_message = "Summarising took too long. Please try again, or use a shorter document."


def build_notes_prompt(request: NotesSummarizeRequest) -> str:
    """The notes go inside a JSON document, so text inside them cannot pose as part of the instructions."""
    document = {"title": request.title, "notes_text": request.text}
    prompt = NOTES_USER_PROMPT_TEMPLATE.format(document_json=json.dumps(document, ensure_ascii=False))

    if request.learning_profile is None:
        return prompt

    return (
        prompt
        + build_profile_section(request.learning_profile)
        + "\n\nApply the personalization to the wording and depth of the summary only. "
        "The output must still be only the JSON structure above."
    )


def parse_summary(raw_text: str) -> NotesSummary:
    """Validate model output. Raises ``QuizValidationError`` (the shared 'bad model output' error) on any problem."""
    data = parse_quiz_json(raw_text)

    try:
        return NotesSummary.model_validate(data)
    except ValidationError as exc:
        raise QuizValidationError("Model output does not match the summary contract.") from exc


def summarize_notes(request: NotesSummarizeRequest) -> NotesSummary:
    """Summarise ``request.text`` with Gemini.

    Raises:
        NotesServiceUnavailableError: Gemini is not configured.
        NotesTimeoutError: Gemini timed out.
        NotesGenerationError: Gemini failed or never produced a valid summary.
    """
    prompt = build_notes_prompt(request)

    for attempt in range(1, MAX_GENERATION_ATTEMPTS + 1):
        try:
            raw_text = generate_text(
                prompt,
                system_instruction=with_profile_note(NOTES_SYSTEM_PROMPT, request.learning_profile),
                json_output=True,
                temperature=0.3,
                timeout_seconds=GEMINI_TIMEOUT_SECONDS,
                model_name=settings.gemini_notes_model,
            )
        except GeminiConfigError as exc:
            logger.error("Notes summary unavailable: %s", exc)
            raise NotesServiceUnavailableError() from exc
        except GeminiTimeoutError as exc:
            logger.warning("Notes summary timed out (attempt %d).", attempt)
            raise NotesTimeoutError() from exc
        except GeminiRequestError as exc:
            logger.error("Notes summary request failed (attempt %d): %s", attempt, exc)
            raise NotesGenerationError() from exc

        try:
            return parse_summary(raw_text)
        except QuizValidationError as exc:
            # The message describes the contract problem only; it never contains the notes or the model output.
            logger.warning("Invalid notes summary on attempt %d/%d: %s", attempt, MAX_GENERATION_ATTEMPTS, exc)

    raise NotesGenerationError()
