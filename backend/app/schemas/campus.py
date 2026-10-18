"""Contracts for the Campus Assistant and the Virtual Classroom summary.

The Campus Assistant answers ONLY from documents the student (or their college) pasted into HIMI. It has no built-in
knowledge of any college. The server verifies every citation against the supplied text, so an answer that cannot be
tied to a real quote is never shown as an answer.
"""

from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.tutor import SUPPORTED_LANGUAGES, TraceEntry, clean_line, clean_multiline

MAX_QUESTION_CHARS = 400
MAX_SOURCES = 8
MAX_SOURCE_TITLE = 80
MAX_SOURCE_TEXT = 4000
MAX_TOTAL_SOURCE_CHARS = 20000
MAX_ANSWER_CHARS = 1500
MAX_CITATIONS = 4
MAX_QUOTE_CHARS = 300
MIN_QUOTE_CHARS = 8


def normalise(text: str) -> str:
    """Whitespace/case-insensitive form used to compare quotes with source text."""
    return re.sub(r"\s+", " ", text).strip().lower()


def _check_language(value: str) -> str:
    if value not in SUPPORTED_LANGUAGES:
        raise ValueError(f"Unsupported language. Supported: {', '.join(SUPPORTED_LANGUAGES)}.")
    return value


class CampusSource(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")
    title: str = Field(min_length=1, max_length=MAX_SOURCE_TITLE)
    text: str = Field(min_length=1, max_length=MAX_SOURCE_TEXT)

    @field_validator("title")
    @classmethod
    def _title_clean(cls, value: str) -> str:
        cleaned = clean_line(value)
        if not cleaned:
            raise ValueError("Title must not be blank.")
        return cleaned

    @field_validator("text")
    @classmethod
    def _text_clean(cls, value: str) -> str:
        cleaned = clean_multiline(value)
        if not cleaned:
            raise ValueError("Text must not be blank.")
        return cleaned


class CampusAskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=1, max_length=MAX_QUESTION_CHARS)
    sources: list[CampusSource] = Field(min_length=1, max_length=MAX_SOURCES)
    language: str = "en"

    @field_validator("question")
    @classmethod
    def _question_clean(cls, value: str) -> str:
        cleaned = clean_line(value)
        if not cleaned:
            raise ValueError("Question must not be blank.")
        return cleaned

    @field_validator("language")
    @classmethod
    def _language(cls, value: str) -> str:
        return _check_language(value)

    @field_validator("sources")
    @classmethod
    def _sources_ok(cls, value: list[CampusSource]) -> list[CampusSource]:
        if len({source.id for source in value}) != len(value):
            raise ValueError("Source ids must be unique.")
        if sum(len(source.text) for source in value) > MAX_TOTAL_SOURCE_CHARS:
            raise ValueError("The documents are too long for one question.")
        return value


class CampusModelOutput(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    answerable: bool
    answer: str = ""
    citations: list[dict[str, Any]] = Field(default_factory=list)

    @field_validator("answer", mode="before")
    @classmethod
    def _answer(cls, value: Any) -> str:
        return clean_multiline(value)[:MAX_ANSWER_CHARS] if isinstance(value, str) else ""

    @field_validator("citations", mode="before")
    @classmethod
    def _citations(cls, value: Any) -> list[Any]:
        return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


class Citation(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    source_id: str = Field(alias="sourceId")
    title: str
    quote: str


class CampusAskResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())

    request_id: str = Field(alias="requestId")
    status: Literal["answered", "not_found"]
    language: str
    answer: str
    citations: list[Citation] = Field(default_factory=list)
    trace: list[TraceEntry] = Field(default_factory=list)
    model_calls: int = Field(default=0, alias="modelCalls")


# ---------------------------------------------------------------- classroom summary

MAX_AGENDA_ITEMS = 10
MAX_AGENDA_CHARS = 120
MAX_NOTES_CHARS = 5000
MAX_QA_PAIRS = 8
MAX_QA_CHARS = 800


class QaPair(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=1, max_length=MAX_QA_CHARS)
    answer: str = Field(default="", max_length=MAX_QA_CHARS)


class ClassroomSummaryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=100)
    subject: str = Field(min_length=1, max_length=60)
    agenda: list[str] = Field(default_factory=list, max_length=MAX_AGENDA_ITEMS)
    notes: str = Field(default="", max_length=MAX_NOTES_CHARS)
    questions: list[QaPair] = Field(default_factory=list, max_length=MAX_QA_PAIRS)
    language: str = "en"

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        cleaned = clean_line(value)
        if not cleaned:
            raise ValueError("Title must not be blank.")
        return cleaned

    @field_validator("agenda")
    @classmethod
    def _agenda(cls, value: list[str]) -> list[str]:
        items = [clean_line(item)[:MAX_AGENDA_CHARS] for item in value]
        return [item for item in items if item]

    @field_validator("notes")
    @classmethod
    def _notes(cls, value: str) -> str:
        return clean_multiline(value)

    @field_validator("language")
    @classmethod
    def _language(cls, value: str) -> str:
        return _check_language(value)

    @field_validator("subject")
    @classmethod
    def _subject(cls, value: str) -> str:
        from app.core.subjects import SUBJECTS

        if value not in SUBJECTS:
            raise ValueError("Unsupported subject.")
        return value


class RevisionQuestion(BaseModel):
    model_config = ConfigDict(extra="ignore")

    question: str = Field(min_length=1, max_length=300)
    hint: str = Field(default="", max_length=300)

    @field_validator("question", "hint", mode="before")
    @classmethod
    def _clean(cls, value: Any) -> Any:
        return clean_line(value) if isinstance(value, str) else value


class ClassroomSummaryOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    summary: str = Field(min_length=1, max_length=1500)
    key_points: list[str] = Field(default_factory=list, alias="keyPoints")
    revision_questions: list[RevisionQuestion] = Field(default_factory=list, alias="revisionQuestions")

    @field_validator("summary", mode="before")
    @classmethod
    def _summary(cls, value: Any) -> Any:
        return clean_multiline(value)[:1500] if isinstance(value, str) else value

    @field_validator("key_points", mode="before")
    @classmethod
    def _points(cls, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        points = [clean_line(item)[:240] for item in value if isinstance(item, str)]
        return [point for point in points if point][:8]

    @field_validator("revision_questions", mode="before")
    @classmethod
    def _questions(cls, value: Any) -> list[Any]:
        if not isinstance(value, list):
            return []
        kept: list[RevisionQuestion] = []
        for item in value:
            try:
                kept.append(RevisionQuestion.model_validate(item))
            except ValueError:
                continue
        return kept[:6]

    model_config = ConfigDict(extra="ignore", populate_by_name=True)


class ClassroomSummaryResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())

    request_id: str = Field(alias="requestId")
    language: str
    summary: str
    key_points: list[str] = Field(alias="keyPoints")
    revision_questions: list[RevisionQuestion] = Field(alias="revisionQuestions")
    trace: list[TraceEntry] = Field(default_factory=list)
    model_calls: int = Field(default=0, alias="modelCalls")
