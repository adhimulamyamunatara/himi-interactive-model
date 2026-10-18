"""Request and response models for the quiz generator."""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.subjects import SUBJECTS

Difficulty = Literal["Easy", "Medium", "Hard"]
QuestionCount = Literal[5, 10, 15]

MAX_TOPIC_LENGTH = 100
# Letters, digits, spaces and the punctuation common in engineering topics ("C++", "TCP/IP", "B+ Trees").
_TOPIC_PATTERN = re.compile(r"^[\w\s\-/&,.()+#:'’]+$")


class QuizGenerateRequest(BaseModel):
    """Options chosen by the student."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    subject: str
    topic: str | None = Field(default=None, max_length=MAX_TOPIC_LENGTH)
    num_questions: QuestionCount = 5
    difficulty: Difficulty = "Medium"

    @field_validator("subject")
    @classmethod
    def _subject_must_be_supported(cls, value: str) -> str:
        if value not in SUBJECTS:
            raise ValueError(f"Unsupported subject. Choose one of: {', '.join(SUBJECTS)}.")
        return value

    @field_validator("topic")
    @classmethod
    def _topic_must_be_clean(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value:
            raise ValueError("Topic must not be blank when provided; omit it to cover the whole subject.")
        value = re.sub(r"\s+", " ", value)
        if not _TOPIC_PATTERN.match(value):
            raise ValueError("Topic contains unsupported characters.")
        return value


class QuizQuestion(BaseModel):
    """One validated multiple-choice question."""

    id: str
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    correct_answer: str
    explanation: str


class QuizPayload(BaseModel):
    """A generated quiz together with the options it was generated for."""

    subject: str
    topic: str | None
    difficulty: Difficulty
    questions: list[QuizQuestion]


class QuizGenerateResponse(BaseModel):
    """Successful response. Errors are returned as ``{"detail": "..."}`` with a non-2xx status."""

    status: Literal["success"] = "success"
    quiz: QuizPayload
