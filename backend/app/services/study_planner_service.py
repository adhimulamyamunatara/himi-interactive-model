"""Study plan generation: build the prompt, call Gemini, and validate the (untrusted) schedule."""

from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import date
from typing import Any

from app.core.config import settings
from app.core.learning_profile_prompt import build_profile_section, with_profile_note
from app.core.study_planner_prompts import (
    PLAN_TYPE_DESCRIPTIONS,
    STUDY_PLANNER_SYSTEM_PROMPT,
    STUDY_PLANNER_USER_PROMPT_TEMPLATE,
)
from app.schemas.study_planner import (
    CRASH_PLAN_MAX_STUDY_DAYS,
    StudyDay,
    StudyPlan,
    StudyPlanGenerateRequest,
    StudyTask,
)
from app.services.gemini_service import GeminiConfigError, GeminiRequestError, GeminiTimeoutError, generate_text
from app.services.quiz_service import QuizValidationError, parse_quiz_json
from app.utils.study_dates import get_study_dates, weekday_name

logger = logging.getLogger(__name__)

# One regeneration is allowed when the model returns an invalid plan. Never loop unbounded.
MAX_GENERATION_ATTEMPTS = 2
GEMINI_TIMEOUT_SECONDS = 120.0

MAX_TASKS_PER_DAY = 8
MIN_TASK_MINUTES = 10
MAX_NOTES = 5
ACTIVITY_TYPES = ("learn", "practice", "revise", "quiz", "mock_test")

_MAX_FOCUS_LENGTH = 120
_MAX_TITLE_LENGTH = 120
_MIN_DESCRIPTION_LENGTH = 10
_MAX_DESCRIPTION_LENGTH = 400
_MAX_NOTE_LENGTH = 200
_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_CONFIDENCE_LABELS = {
    "need_to_start": "Need to start (has not begun this subject)",
    "basic": "Basic understanding",
    "comfortable": "Comfortable",
    "strong": "Strong understanding",
}


class StudyPlannerError(Exception):
    """Base class for errors the API layer turns into HTTP responses."""

    status_code = 500
    public_message = "Study plan generation failed. Please try again."


class StudyPlannerUnavailableError(StudyPlannerError):
    """Gemini is not configured on the server."""

    status_code = 503
    public_message = "The study planner is not available right now. Please try again later."


class StudyPlanGenerationError(StudyPlannerError):
    """Gemini failed or kept returning invalid plans."""

    status_code = 502
    public_message = "HIMI couldn't build a valid study plan this time. Please try again."


class StudyPlannerTimeoutError(StudyPlannerError):
    """Gemini took too long to answer."""

    status_code = 504
    public_message = "Study plan generation took too long. Try again, or choose fewer subjects or a closer exam date."


class StudyPlanValidationError(ValueError):
    """The model output does not satisfy the study plan contract."""


def get_plan_type(study_day_count: int) -> str:
    """``crash_revision`` when almost no study days remain, otherwise ``standard``."""
    return "crash_revision" if study_day_count <= CRASH_PLAN_MAX_STUDY_DAYS else "standard"


def build_study_plan_prompt(request: StudyPlanGenerateRequest, study_dates: list[date]) -> str:
    """Render the user prompt. The student's text travels inside a JSON document so it stays data."""
    request_document = {
        "title": request.title,
        "today": request.start_date.isoformat(),
        "exam_date": request.exam_date.isoformat(),
        "allowed_study_dates": [{"date": day.isoformat(), "weekday": weekday_name(day)} for day in study_dates],
        "daily_available_minutes": request.daily_available_minutes,
        "subjects": [
            {
                "subject": item.subject,
                "confidence": _CONFIDENCE_LABELS[item.confidence],
                "topics": item.topics,
            }
            for item in request.subjects
        ],
        "additional_instructions": request.additional_instructions,
    }

    prompt = STUDY_PLANNER_USER_PROMPT_TEMPLATE.format(
        request_json=json.dumps(request_document, ensure_ascii=False, indent=2),
        plan_type_description=PLAN_TYPE_DESCRIPTIONS[get_plan_type(len(study_dates))],
        max_tasks_per_day=MAX_TASKS_PER_DAY,
        min_task_minutes=MIN_TASK_MINUTES,
        max_notes=MAX_NOTES,
    )

    if request.learning_profile is None:
        return prompt

    return (
        prompt
        + build_profile_section(request.learning_profile)
        + "\n\nApply the personalization to task choice and wording: give extra time to the topics marked difficult "
        "(only for the selected subjects), favour the preferred revision style in 'revise' tasks and keep the "
        "explanation level in mind. Every scheduling rule above still applies, and the output must still be only "
        "the JSON structure above."
    )


def parse_plan_json(raw_text: str) -> Any:
    """Parse model output as JSON, tolerating Markdown fences or surrounding prose."""
    try:
        return parse_quiz_json(raw_text)
    except QuizValidationError as exc:
        raise StudyPlanValidationError("Model output is not valid JSON.") from exc


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def _require_text(value: Any, field: str, where: str, max_length: int, min_length: int = 1) -> str:
    if not isinstance(value, str) or not value.strip():
        raise StudyPlanValidationError(f"{where}: '{field}' must be a non-empty string.")
    cleaned = re.sub(r"\s+", " ", value).strip()
    if len(cleaned) < min_length:
        raise StudyPlanValidationError(f"{where}: '{field}' is too short to be useful.")
    if len(cleaned) > max_length:
        raise StudyPlanValidationError(f"{where}: '{field}' is too long.")
    return cleaned


def _parse_duration(value: Any, where: str) -> int:
    # bool is an int subclass in Python, so reject it explicitly.
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise StudyPlanValidationError(f"{where}: 'duration_minutes' must be a number.")
    if isinstance(value, float) and not value.is_integer():
        raise StudyPlanValidationError(f"{where}: 'duration_minutes' must be a whole number.")
    return int(value)


def sanitize_notes(raw_notes: Any) -> list[str]:
    """Notes are optional advice. Keep valid short strings and drop anything else."""
    if not isinstance(raw_notes, list):
        return []

    notes: list[str] = []
    for note in raw_notes:
        if isinstance(note, str) and note.strip():
            notes.append(re.sub(r"\s+", " ", note).strip()[:_MAX_NOTE_LENGTH])
        if len(notes) == MAX_NOTES:
            break
    return notes


def validate_schedule(data: Any, request: StudyPlanGenerateRequest, study_dates: list[date]) -> list[StudyDay]:
    """Validate parsed model output against the request and return clean days.

    Raises:
        StudyPlanValidationError: on any structural, date, subject or time problem.
            Nothing malformed is ever returned.
    """
    raw_days = data.get("schedule") if isinstance(data, dict) else None

    if not isinstance(raw_days, list) or not raw_days:
        raise StudyPlanValidationError("Missing or empty 'schedule' list.")

    if len(raw_days) > len(study_dates):
        raise StudyPlanValidationError("The schedule has more days than there are study days.")

    allowed_dates = set(study_dates)
    selected_subjects = {item.subject for item in request.subjects}
    used_subjects: set[str] = set()
    seen_titles: set[tuple[str, str]] = set()
    days: list[StudyDay] = []
    previous_date: date | None = None
    task_counter = 0

    for day_index, raw_day in enumerate(raw_days, start=1):
        where = f"Day {day_index}"

        if not isinstance(raw_day, dict):
            raise StudyPlanValidationError(f"{where} is not an object.")

        raw_date = raw_day.get("date")
        if not isinstance(raw_date, str) or not _DATE_PATTERN.match(raw_date.strip()):
            raise StudyPlanValidationError(f"{where}: 'date' must be formatted YYYY-MM-DD.")
        try:
            day_date = date.fromisoformat(raw_date.strip())
        except ValueError as exc:
            raise StudyPlanValidationError(f"{where}: '{raw_date}' is not a real date.") from exc

        if day_date not in allowed_dates:
            raise StudyPlanValidationError(
                f"{where}: {day_date.isoformat()} is not an allowed study date "
                "(outside the window, on an excluded weekday, or on/after the exam)."
            )
        if previous_date is not None and day_date == previous_date:
            raise StudyPlanValidationError(f"{where}: duplicate date {day_date.isoformat()}.")
        if previous_date is not None and day_date < previous_date:
            raise StudyPlanValidationError(f"{where}: dates are not in chronological order.")
        previous_date = day_date

        focus = _require_text(raw_day.get("focus"), "focus", where, _MAX_FOCUS_LENGTH)

        raw_tasks = raw_day.get("tasks")
        if not isinstance(raw_tasks, list) or not raw_tasks:
            raise StudyPlanValidationError(f"{where}: at least one task is required.")
        if len(raw_tasks) > MAX_TASKS_PER_DAY:
            raise StudyPlanValidationError(f"{where}: at most {MAX_TASKS_PER_DAY} tasks per day.")

        tasks: list[StudyTask] = []
        day_minutes = 0

        for task_index, raw_task in enumerate(raw_tasks, start=1):
            task_where = f"{where}, task {task_index}"

            if not isinstance(raw_task, dict):
                raise StudyPlanValidationError(f"{task_where} is not an object.")

            subject = raw_task.get("subject")
            if not isinstance(subject, str) or subject.strip() not in selected_subjects:
                raise StudyPlanValidationError(f"{task_where}: subject is not one of the selected subjects.")
            subject = subject.strip()

            title = _require_text(raw_task.get("title"), "title", task_where, _MAX_TITLE_LENGTH)
            description = _require_text(
                raw_task.get("description"),
                "description",
                task_where,
                _MAX_DESCRIPTION_LENGTH,
                min_length=_MIN_DESCRIPTION_LENGTH,
            )

            title_key = (subject, _normalize(title))
            if title_key in seen_titles:
                raise StudyPlanValidationError(f"{task_where}: task title '{title}' is repeated.")
            seen_titles.add(title_key)

            duration = _parse_duration(raw_task.get("duration_minutes"), task_where)
            if duration < MIN_TASK_MINUTES or duration > request.daily_available_minutes:
                raise StudyPlanValidationError(
                    f"{task_where}: duration must be between {MIN_TASK_MINUTES} and "
                    f"{request.daily_available_minutes} minutes."
                )

            activity_type = raw_task.get("activity_type")
            if activity_type not in ACTIVITY_TYPES:
                raise StudyPlanValidationError(f"{task_where}: unsupported activity_type.")

            day_minutes += duration
            used_subjects.add(subject)
            task_counter += 1
            tasks.append(
                StudyTask(
                    id=f"task-{task_counter}",
                    subject=subject,
                    title=title,
                    description=description,
                    duration_minutes=duration,
                    activity_type=activity_type,
                    completed=False,
                )
            )

        if day_minutes > request.daily_available_minutes:
            raise StudyPlanValidationError(
                f"{where}: {day_minutes} minutes exceeds the {request.daily_available_minutes}-minute daily limit."
            )

        days.append(StudyDay(date=day_date, focus=focus, total_minutes=day_minutes, tasks=tasks))

    missing = selected_subjects - used_subjects
    if missing:
        raise StudyPlanValidationError(f"Selected subjects missing from the plan: {', '.join(sorted(missing))}.")

    return days


def _default_title(request: StudyPlanGenerateRequest) -> str:
    if request.title:
        return request.title
    names = [item.subject for item in request.subjects]
    if len(names) == 1:
        return f"{names[0]} exam preparation"
    if len(names) == 2:
        return f"{names[0]} and {names[1]} exam preparation"
    return f"{names[0]} + {len(names) - 1} more subjects: exam preparation"


def generate_study_plan(request: StudyPlanGenerateRequest) -> StudyPlan:
    """Generate a validated study plan with Gemini.

    Raises:
        StudyPlannerUnavailableError: Gemini is not configured.
        StudyPlannerTimeoutError: Gemini timed out.
        StudyPlanGenerationError: Gemini failed or never produced a valid plan.
    """
    study_dates = get_study_dates(request.start_date, request.exam_date, request.preferred_study_days or [])
    if not study_dates:
        # The request schema already rejects this; kept as a defensive guard.
        raise StudyPlanGenerationError()

    prompt = build_study_plan_prompt(request, study_dates)

    for attempt in range(1, MAX_GENERATION_ATTEMPTS + 1):
        try:
            raw_text = generate_text(
                prompt,
                system_instruction=with_profile_note(STUDY_PLANNER_SYSTEM_PROMPT, request.learning_profile),
                json_output=True,
                temperature=0.4,
                timeout_seconds=GEMINI_TIMEOUT_SECONDS,
                model_name=settings.gemini_planner_model,
            )
        except GeminiConfigError as exc:
            logger.error("Study planner unavailable: %s", exc)
            raise StudyPlannerUnavailableError() from exc
        except GeminiTimeoutError as exc:
            logger.warning("Study plan generation timed out (attempt %d).", attempt)
            raise StudyPlannerTimeoutError() from exc
        except GeminiRequestError as exc:
            logger.error("Study plan request failed (attempt %d): %s", attempt, exc)
            raise StudyPlanGenerationError() from exc

        try:
            data = parse_plan_json(raw_text)
            schedule = validate_schedule(data, request, study_dates)
        except StudyPlanValidationError as exc:
            logger.warning("Invalid study plan on attempt %d/%d: %s", attempt, MAX_GENERATION_ATTEMPTS, exc)
            continue

        return StudyPlan(
            id=uuid.uuid4().hex,
            title=_default_title(request),
            exam_date=request.exam_date,
            start_date=request.start_date,
            plan_type=get_plan_type(len(study_dates)),
            subjects=[item.subject for item in request.subjects],
            daily_available_minutes=request.daily_available_minutes,
            preferred_study_days=request.preferred_study_days or [],
            total_planned_minutes=sum(day.total_minutes for day in schedule),
            total_tasks=sum(len(day.tasks) for day in schedule),
            suggested_topic_subjects=[item.subject for item in request.subjects if not item.topics],
            notes=sanitize_notes(data.get("notes") if isinstance(data, dict) else None),
            schedule=schedule,
        )

    raise StudyPlanGenerationError()
