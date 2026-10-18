"""Quiz generation: build the prompt, call Gemini, and validate the (untrusted) output."""

from __future__ import annotations

import json
import logging
import random
import re
from typing import Any

from pydantic import ValidationError

from app.core.config import settings
from app.core.learning_profile_prompt import build_profile_section, with_profile_note
from app.core.quiz_prompts import DEFAULT_TOPIC_TEXT, QUIZ_SYSTEM_PROMPT, QUIZ_USER_PROMPT_TEMPLATE
from app.schemas.quiz import QuizGenerateRequest, QuizPayload, QuizQuestion
from app.services.gemini_service import GeminiConfigError, GeminiRequestError, GeminiTimeoutError, generate_text

logger = logging.getLogger(__name__)

# One regeneration is allowed when the model returns invalid output. Never loop unbounded.
MAX_GENERATION_ATTEMPTS = 2
GEMINI_TIMEOUT_SECONDS = 90.0  # larger "thinking" models took up to ~65s for a quiz in manual tests

_MAX_QUESTION_LENGTH = 1500
_MAX_OPTION_LENGTH = 400
_MAX_EXPLANATION_LENGTH = 1500
_FENCE_PATTERN = re.compile(r"^```[a-zA-Z0-9_-]*\s*\n?(.*?)\n?```$", re.DOTALL)


class QuizServiceError(Exception):
    """Base class for errors the API layer turns into HTTP responses."""

    status_code = 500
    public_message = "Quiz generation failed. Please try again."


class QuizServiceUnavailableError(QuizServiceError):
    """Gemini is not configured on the server."""

    status_code = 503
    public_message = "The quiz service is not available right now. Please try again later."


class QuizGenerationError(QuizServiceError):
    """Gemini failed or kept returning invalid quizzes."""

    status_code = 502
    public_message = "HIMI couldn't generate a valid quiz this time. Please try again."


class QuizTimeoutError(QuizServiceError):
    """Gemini took too long to answer."""

    status_code = 504
    public_message = "Quiz generation took too long. Please try again, or choose fewer questions."


class QuizValidationError(ValueError):
    """The model output does not satisfy the quiz contract."""


def build_quiz_prompt(request: QuizGenerateRequest) -> str:
    """Render the user prompt for ``request``."""
    prompt = QUIZ_USER_PROMPT_TEMPLATE.format(
        subject=request.subject,
        topic=request.topic or DEFAULT_TOPIC_TEXT,
        difficulty=request.difficulty,
        num_questions=request.num_questions,
    )

    if request.learning_profile is None:
        return prompt

    return (
        prompt
        + build_profile_section(request.learning_profile)
        + "\n\nApply the personalization only to the wording of the explanations and, when they fit the subject, "
        "to emphasis on topics marked difficult. Question difficulty stays as requested. "
        "The output must still be only the JSON structure above."
    )


def parse_quiz_json(raw_text: str) -> Any:
    """Parse model output as JSON, tolerating Markdown fences or surrounding prose."""
    text = raw_text.strip()

    fenced = _FENCE_PATTERN.match(text)
    if fenced:
        text = fenced.group(1).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    raise QuizValidationError("Model output is not valid JSON.")


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def _require_text(value: Any, field: str, index: int, max_length: int) -> str:
    if not isinstance(value, str) or not value.strip():
        raise QuizValidationError(f"Question {index}: '{field}' must be a non-empty string.")
    cleaned = value.strip()
    if len(cleaned) > max_length:
        raise QuizValidationError(f"Question {index}: '{field}' is too long.")
    return cleaned


def validate_questions(data: Any, expected_count: int) -> list[QuizQuestion]:
    """Validate parsed model output and return clean questions.

    Raises:
        QuizValidationError: on any structural or content problem. Nothing malformed is returned.
    """
    raw_questions = data.get("questions") if isinstance(data, dict) else data

    if not isinstance(raw_questions, list):
        raise QuizValidationError("Missing 'questions' list.")

    if len(raw_questions) != expected_count:
        raise QuizValidationError(f"Expected {expected_count} questions but received {len(raw_questions)}.")

    questions: list[QuizQuestion] = []
    seen_ids: set[str] = set()
    seen_questions: set[str] = set()

    for index, item in enumerate(raw_questions, start=1):
        if not isinstance(item, dict):
            raise QuizValidationError(f"Question {index} is not an object.")

        question_id = _require_text(item.get("id"), "id", index, 40)
        if question_id in seen_ids:
            raise QuizValidationError(f"Duplicate question id '{question_id}'.")
        seen_ids.add(question_id)

        question_text = _require_text(item.get("question"), "question", index, _MAX_QUESTION_LENGTH)
        normalized_question = _normalize(question_text)
        if normalized_question in seen_questions:
            raise QuizValidationError(f"Question {index} repeats an earlier question.")
        seen_questions.add(normalized_question)

        raw_options = item.get("options")
        if not isinstance(raw_options, list) or len(raw_options) != 4:
            raise QuizValidationError(f"Question {index}: exactly 4 options are required.")
        options = [_require_text(option, "options", index, _MAX_OPTION_LENGTH) for option in raw_options]
        if len({_normalize(option) for option in options}) != 4:
            raise QuizValidationError(f"Question {index}: options must be distinct.")

        correct_answer = _require_text(item.get("correct_answer"), "correct_answer", index, _MAX_OPTION_LENGTH)
        if correct_answer not in options:
            raise QuizValidationError(f"Question {index}: correct_answer does not match any option.")

        explanation = _require_text(item.get("explanation"), "explanation", index, _MAX_EXPLANATION_LENGTH)

        try:
            questions.append(
                QuizQuestion(
                    id=question_id,
                    question=question_text,
                    options=options,
                    correct_answer=correct_answer,
                    explanation=explanation,
                )
            )
        except ValidationError as exc:  # defensive: the checks above should already guarantee validity
            raise QuizValidationError(f"Question {index} failed schema validation.") from exc

    return questions


def shuffle_options(questions: list[QuizQuestion], rng: random.Random | None = None) -> list[QuizQuestion]:
    """Shuffle each question's options so the correct answer is not biased towards one position.

    ``correct_answer`` is stored as text, so shuffling never invalidates the answer key.
    """
    rng = rng or random.Random()
    shuffled: list[QuizQuestion] = []

    for question in questions:
        options = list(question.options)
        rng.shuffle(options)
        shuffled.append(question.model_copy(update={"options": options}))

    return shuffled


def generate_quiz(request: QuizGenerateRequest) -> QuizPayload:
    """Generate a validated quiz with Gemini.

    Raises:
        QuizServiceUnavailableError: Gemini is not configured.
        QuizTimeoutError: Gemini timed out.
        QuizGenerationError: Gemini failed or never produced a valid quiz.
    """
    prompt = build_quiz_prompt(request)

    for attempt in range(1, MAX_GENERATION_ATTEMPTS + 1):
        try:
            raw_text = generate_text(
                prompt,
                system_instruction=with_profile_note(QUIZ_SYSTEM_PROMPT, request.learning_profile),
                json_output=True,
                timeout_seconds=GEMINI_TIMEOUT_SECONDS,
                model_name=settings.gemini_quiz_model,
            )
        except GeminiConfigError as exc:
            logger.error("Quiz generation unavailable: %s", exc)
            raise QuizServiceUnavailableError() from exc
        except GeminiTimeoutError as exc:
            logger.warning("Quiz generation timed out (attempt %d).", attempt)
            raise QuizTimeoutError() from exc
        except GeminiRequestError as exc:
            logger.error("Quiz generation request failed (attempt %d): %s", attempt, exc)
            raise QuizGenerationError() from exc

        try:
            questions = validate_questions(parse_quiz_json(raw_text), request.num_questions)
        except QuizValidationError as exc:
            logger.warning("Invalid quiz output on attempt %d/%d: %s", attempt, MAX_GENERATION_ATTEMPTS, exc)
            continue

        return QuizPayload(
            subject=request.subject,
            topic=request.topic,
            difficulty=request.difficulty,
            questions=shuffle_options(questions),
        )

    raise QuizGenerationError()
