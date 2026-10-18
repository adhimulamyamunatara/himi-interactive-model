"""Request and response models for the AI study planner."""

from __future__ import annotations

import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.subjects import SUBJECTS
from app.schemas.learning_profile import LearningProfile
from app.utils.study_dates import WEEKDAYS, get_study_dates

Weekday = Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
Confidence = Literal["need_to_start", "basic", "comfortable", "strong"]
ActivityType = Literal["learn", "practice", "revise", "quiz", "mock_test"]
PlanType = Literal["standard", "crash_revision"]
# Alias so that models with a field called ``date`` do not shadow the type.
CalendarDate = date

MAX_TITLE_LENGTH = 80
MAX_TOPIC_LENGTH = 60
MAX_TOPICS_PER_SUBJECT = 10
MAX_INSTRUCTIONS_LENGTH = 300
MIN_DAILY_MINUTES = 15
MAX_DAILY_MINUTES = 360
# Longest window (days between start and exam) a single plan may cover. Larger plans make the
# AI response too slow and too large to validate reliably.
MAX_PLAN_DAYS = 30
# At most this many study days => a labelled "crash revision" plan instead of a standard one.
CRASH_PLAN_MAX_STUDY_DAYS = 2
# The browser sends its own local date; allow for time zones but reject wildly wrong dates.
MAX_CLIENT_DATE_SKEW_DAYS = 1

# Letters, digits, spaces and the punctuation common in engineering topics ("C++", "TCP/IP", "B+ Trees").
_TEXT_PATTERN = re.compile(r"^[\w\s\-/&,.()+#:'’]+$")
_CONTROL_CHARACTERS = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")


def _collapse_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


class StudySubjectInput(BaseModel):
    """One subject the student wants to prepare, with optional topics and a self-assessment."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    subject: str
    topics: list[str] = Field(default_factory=list)
    confidence: Confidence

    @field_validator("subject")
    @classmethod
    def _subject_must_be_supported(cls, value: str) -> str:
        if value not in SUBJECTS:
            raise ValueError(f"Unsupported subject. Choose one of: {', '.join(SUBJECTS)}.")
        return value

    @field_validator("topics", mode="before")
    @classmethod
    def _topics_from_text_or_list(cls, value: object) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            value = re.split(r"[,;\n]", value)
        if not isinstance(value, list):
            raise ValueError("Topics must be a list of names or a comma-separated string.")

        cleaned: list[str] = []
        seen: set[str] = set()

        for item in value:
            if not isinstance(item, str):
                raise ValueError("Each topic must be text.")
            topic = _collapse_whitespace(item)
            if not topic:
                continue
            if len(topic) > MAX_TOPIC_LENGTH:
                raise ValueError(f"Each topic must be at most {MAX_TOPIC_LENGTH} characters.")
            if not _TEXT_PATTERN.match(topic):
                raise ValueError("Topics contain unsupported characters.")
            if topic.lower() not in seen:
                seen.add(topic.lower())
                cleaned.append(topic)

        if len(cleaned) > MAX_TOPICS_PER_SUBJECT:
            raise ValueError(f"Add at most {MAX_TOPICS_PER_SUBJECT} topics per subject.")
        return cleaned


class StudyPlanGenerateRequest(BaseModel):
    """Everything the planner needs. ``start_date`` is the student's local calendar date today."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str | None = Field(default=None, max_length=MAX_TITLE_LENGTH)
    exam_date: CalendarDate
    start_date: CalendarDate
    subjects: list[StudySubjectInput] = Field(min_length=1, max_length=len(SUBJECTS))
    daily_available_minutes: int = Field(ge=MIN_DAILY_MINUTES, le=MAX_DAILY_MINUTES)
    # validate_default so that an omitted value also becomes "every day".
    preferred_study_days: list[Weekday] | None = Field(default=None, validate_default=True)
    additional_instructions: str | None = Field(default=None, max_length=MAX_INSTRUCTIONS_LENGTH)
    learning_profile: LearningProfile | None = None

    @field_validator("title")
    @classmethod
    def _title_must_be_clean(cls, value: str | None) -> str | None:
        if not value:
            return None
        value = _collapse_whitespace(value)
        if not _TEXT_PATTERN.match(value):
            raise ValueError("Title contains unsupported characters.")
        return value

    @field_validator("additional_instructions")
    @classmethod
    def _instructions_must_be_clean(cls, value: str | None) -> str | None:
        if not value:
            return None
        value = _collapse_whitespace(_CONTROL_CHARACTERS.sub(" ", value))
        return value or None

    @field_validator("preferred_study_days")
    @classmethod
    def _days_default_to_every_day(cls, value: list[str] | None) -> list[str]:
        """No selection means every day. Duplicates are dropped and the order is Monday..Sunday."""
        if not value:
            return list(WEEKDAYS)
        chosen = set(value)
        return [day for day in WEEKDAYS if day in chosen]

    @model_validator(mode="after")
    def _check_subjects_and_dates(self) -> "StudyPlanGenerateRequest":
        names = [item.subject for item in self.subjects]
        if len(set(names)) != len(names):
            raise ValueError("Each subject can only be selected once.")

        if abs((self.start_date - date.today()).days) > MAX_CLIENT_DATE_SKEW_DAYS:
            raise ValueError("start_date must be today's date.")

        days_until_exam = (self.exam_date - self.start_date).days

        if days_until_exam == 0:
            raise ValueError(
                "The exam is today. A plan covers the days before the exam, so choose a later exam date."
            )
        if days_until_exam < 0:
            raise ValueError("The exam date is in the past. Choose a date after today.")
        if days_until_exam > MAX_PLAN_DAYS:
            raise ValueError(f"The exam must be within {MAX_PLAN_DAYS} days. Choose a closer date.")

        if not get_study_dates(self.start_date, self.exam_date, self.preferred_study_days):
            raise ValueError("None of your preferred study days fall before the exam. Add more days or pick a later date.")

        return self


class StudyTask(BaseModel):
    """One actionable task. IDs are assigned by the server, never by the model."""

    id: str
    subject: str
    title: str
    description: str
    duration_minutes: int
    activity_type: ActivityType
    completed: bool = False


class StudyDay(BaseModel):
    """All tasks planned for one calendar date."""

    date: CalendarDate
    focus: str
    total_minutes: int
    tasks: list[StudyTask]


class StudyPlan(BaseModel):
    """A validated, ready-to-save study plan."""

    id: str
    title: str
    exam_date: CalendarDate
    start_date: CalendarDate
    plan_type: PlanType
    subjects: list[str]
    daily_available_minutes: int
    preferred_study_days: list[Weekday]
    total_planned_minutes: int
    total_tasks: int
    # Subjects where the student gave no topics, so the AI suggested them. The UI labels these.
    suggested_topic_subjects: list[str]
    notes: list[str]
    schedule: list[StudyDay]


class StudyPlanGenerateResponse(BaseModel):
    """Successful response. Errors are returned as ``{"detail": "..."}`` with a non-2xx status."""

    status: Literal["success"] = "success"
    plan: StudyPlan
