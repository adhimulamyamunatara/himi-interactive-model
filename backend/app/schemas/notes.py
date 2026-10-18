"""Request and response models for the PDF notes feature."""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.learning_profile import LearningProfile

# Limits shared by the extraction and summarisation endpoints.
MAX_PDF_BYTES = 5 * 1024 * 1024
MAX_PDF_PAGES = 60
MAX_NOTES_CHARS = 60_000
MIN_NOTES_CHARS = 40
MAX_TITLE_LENGTH = 120

_CONTROL_CHARACTERS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")


class NotesExtractResponse(BaseModel):
    status: Literal["success"] = "success"
    text: str
    page_count: int
    word_count: int
    character_count: int
    truncated: bool


class NotesSummarizeRequest(BaseModel):
    """The text to summarise. It is sent by the student, after the student pressed "Summarize"."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=MIN_NOTES_CHARS, max_length=MAX_NOTES_CHARS)
    title: str | None = Field(default=None, max_length=MAX_TITLE_LENGTH)
    learning_profile: LearningProfile | None = None

    @field_validator("text")
    @classmethod
    def _text_must_have_content(cls, value: str) -> str:
        cleaned = _CONTROL_CHARACTERS.sub(" ", value).strip()
        if len(cleaned) < MIN_NOTES_CHARS:
            raise ValueError("The notes contain too little text to summarise.")
        return cleaned

    @field_validator("title")
    @classmethod
    def _title_must_be_clean(cls, value: str | None) -> str | None:
        if not value:
            return None
        cleaned = re.sub(r"\s+", " ", _CONTROL_CHARACTERS.sub(" ", value)).strip()
        return cleaned or None


def _bounded(text: str, max_length: int, label: str) -> str:
    cleaned = re.sub(r"[ \t]+", " ", text).strip()
    if not cleaned:
        raise ValueError(f"{label} must not be empty.")
    if len(cleaned) > max_length:
        raise ValueError(f"{label} is too long.")
    return cleaned


class KeyConcept(BaseModel):
    term: str
    explanation: str

    @field_validator("term")
    @classmethod
    def _term(cls, value: str) -> str:
        return _bounded(value, 120, "Concept name")

    @field_validator("explanation")
    @classmethod
    def _explanation(cls, value: str) -> str:
        return _bounded(value, 600, "Concept explanation")


class Definition(BaseModel):
    term: str
    definition: str

    @field_validator("term")
    @classmethod
    def _term(cls, value: str) -> str:
        return _bounded(value, 120, "Defined term")

    @field_validator("definition")
    @classmethod
    def _definition(cls, value: str) -> str:
        return _bounded(value, 600, "Definition")


class NotesSummary(BaseModel):
    """The structured summary. Built from model output, so every field is validated."""

    summary: str
    key_concepts: list[KeyConcept] = Field(min_length=1, max_length=10)
    definitions: list[Definition] = Field(default_factory=list, max_length=10)
    takeaways: list[str] = Field(min_length=1, max_length=8)
    revision_questions: list[str] = Field(min_length=1, max_length=8)

    @field_validator("summary")
    @classmethod
    def _summary(cls, value: str) -> str:
        return _bounded(value, 2500, "Summary")

    @field_validator("takeaways")
    @classmethod
    def _takeaways(cls, value: list[str]) -> list[str]:
        return [_bounded(item, 400, "Takeaway") for item in value]

    @field_validator("revision_questions")
    @classmethod
    def _questions(cls, value: list[str]) -> list[str]:
        return [_bounded(item, 400, "Revision question") for item in value]


class NotesSummarizeResponse(BaseModel):
    status: Literal["success"] = "success"
    title: str | None
    notes: NotesSummary
