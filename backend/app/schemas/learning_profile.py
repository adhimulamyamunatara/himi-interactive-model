"""The student's learning profile, as sent with AI requests.

The profile is created and stored in the student's browser. The backend never stores it: it only
validates it and uses it to tailor the prompt of the current request.
"""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.subjects import SUBJECTS

ExplanationLevel = Literal["beginner", "intermediate", "advanced"]
ExplanationStyle = Literal["step_by_step", "examples_first", "concise", "detailed"]
ExplanationLanguage = Literal["english", "telugu_english"]
QuizStyle = Literal["mixed", "conceptual", "practical"]
RevisionStyle = Literal["summaries", "practice_questions", "flashcards", "spaced_review"]

MAX_GOALS = 5
MAX_GOAL_LENGTH = 120
MAX_INTERESTS = 10
MAX_INTEREST_LENGTH = 60
MAX_DIFFICULT_TOPICS = 15
MAX_TOPIC_LENGTH = 80

# Control characters (including newlines) are never useful in profile text and are a common injection vehicle.
_CONTROL_CHARACTERS = re.compile(r"[\x00-\x1f\x7f-\x9f]")


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", _CONTROL_CHARACTERS.sub(" ", text)).strip()


def _clean_list(values: list[str], max_items: int, max_length: int, label: str) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = _clean(value)
        if not text:
            continue
        if len(text) > max_length:
            raise ValueError(f"Each {label} must be at most {max_length} characters.")
        if text.lower() in seen:
            continue
        seen.add(text.lower())
        cleaned.append(text)
    if len(cleaned) > max_items:
        raise ValueError(f"At most {max_items} {label}s are allowed.")
    return cleaned


class DifficultTopic(BaseModel):
    """A topic the student explicitly marked as difficult."""

    model_config = ConfigDict(extra="forbid")

    subject: str | None = None
    topic: str = Field(min_length=1, max_length=MAX_TOPIC_LENGTH)

    @field_validator("subject")
    @classmethod
    def _subject_must_be_supported(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if value not in SUBJECTS:
            raise ValueError("Unsupported subject in difficult topics.")
        return value

    @field_validator("topic")
    @classmethod
    def _topic_must_be_clean(cls, value: str) -> str:
        cleaned = _clean(value)
        if not cleaned:
            raise ValueError("Topic must not be blank.")
        return cleaned


class LearningProfile(BaseModel):
    """Preferences the student chose (nothing here is inferred about the student)."""

    model_config = ConfigDict(extra="forbid")

    explanation_level: ExplanationLevel = "intermediate"
    explanation_style: ExplanationStyle = "step_by_step"
    language: ExplanationLanguage = "english"
    quiz_style: QuizStyle = "mixed"
    revision_style: RevisionStyle = "practice_questions"
    goals: list[str] = Field(default_factory=list, max_length=MAX_GOALS * 4)
    interests: list[str] = Field(default_factory=list, max_length=MAX_INTERESTS * 4)
    difficult_topics: list[DifficultTopic] = Field(default_factory=list, max_length=MAX_DIFFICULT_TOPICS * 4)

    @field_validator("goals")
    @classmethod
    def _goals(cls, value: list[str]) -> list[str]:
        return _clean_list(value, MAX_GOALS, MAX_GOAL_LENGTH, "goal")

    @field_validator("interests")
    @classmethod
    def _interests(cls, value: list[str]) -> list[str]:
        return _clean_list(value, MAX_INTERESTS, MAX_INTEREST_LENGTH, "interest")

    @field_validator("difficult_topics")
    @classmethod
    def _difficult_topics(cls, value: list[DifficultTopic]) -> list[DifficultTopic]:
        unique: list[DifficultTopic] = []
        seen: set[tuple[str | None, str]] = set()
        for item in value:
            key = (item.subject, item.topic.lower())
            if key not in seen:
                seen.add(key)
                unique.append(item)
        if len(unique) > MAX_DIFFICULT_TOPICS:
            raise ValueError(f"At most {MAX_DIFFICULT_TOPICS} difficult topics are allowed.")
        return unique
