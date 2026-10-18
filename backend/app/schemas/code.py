"""Contracts for the Coding Assistant. The assistant ANALYSES code; nothing the student submits is ever executed.

The model's output is untrusted and validated here. Optional pieces that are malformed are dropped rather than
failing the whole answer.
"""

from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.learning_profile import LearningProfile
from app.schemas.tutor import (
    SUPPORTED_LANGUAGES,
    HelpMode,
    ReviewResult,
    TraceEntry,
    clean_line,
    clean_multiline,
)

# Programming languages the assistant supports. Add one here (and to the frontend list) to extend it.
CODE_LANGUAGES: dict[str, str] = {"python": "Python", "java": "Java", "c": "C", "javascript": "JavaScript"}

MAX_CODE_CHARS = 8000
MAX_CODE_LINES = 300
MAX_QUESTION_CHARS = 500
MAX_ERROR_CHARS = 1500
MAX_FINDINGS = 8
MAX_HINTS = 5
MAX_TEST_CASES = 6
MAX_FOLLOW_UPS = 3

CodeTask = Literal["explain", "debug", "hints", "complexity", "tests"]
Severity = Literal["info", "warning", "error"]

_CONTROL_CHARACTERS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")


def clean_code(text: str) -> str:
    """Remove control characters but keep indentation, tabs and newlines. Only trailing whitespace is trimmed."""
    return _CONTROL_CHARACTERS.sub("", text).replace("\r\n", "\n").replace("\r", "\n").rstrip()


class CodeAssistRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1, max_length=MAX_CODE_CHARS)
    codeLanguage: str
    task: CodeTask
    question: str | None = Field(default=None, max_length=MAX_QUESTION_CHARS)
    # Error text the student pasted from their own run. HIMI never runs the code to produce it.
    errorOutput: str | None = Field(default=None, max_length=MAX_ERROR_CHARS)
    # Language the explanation is written in (the programming language is `codeLanguage`).
    language: str = "en"
    helpMode: HelpMode = "guided"
    learningProfile: LearningProfile | None = None

    @field_validator("code")
    @classmethod
    def _code_clean(cls, value: str) -> str:
        cleaned = clean_code(value)
        if not cleaned.strip():
            raise ValueError("Code must not be blank.")
        if cleaned.count("\n") + 1 > MAX_CODE_LINES:
            raise ValueError(f"Code is too long. Please submit at most {MAX_CODE_LINES} lines.")
        return cleaned

    @field_validator("codeLanguage")
    @classmethod
    def _code_language_supported(cls, value: str) -> str:
        if value not in CODE_LANGUAGES:
            raise ValueError(f"Unsupported programming language. Supported: {', '.join(CODE_LANGUAGES)}.")
        return value

    @field_validator("question", "errorOutput")
    @classmethod
    def _optional_text_clean(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = clean_multiline(value)
        return cleaned or None

    @field_validator("language")
    @classmethod
    def _language_supported(cls, value: str) -> str:
        if value not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported language. Supported: {', '.join(SUPPORTED_LANGUAGES)}.")
        return value


class CodeFinding(BaseModel):
    model_config = ConfigDict(extra="ignore")

    severity: Severity = "info"
    line: int | None = Field(default=None, ge=1)
    title: str = Field(min_length=1, max_length=120)
    detail: str = Field(min_length=1, max_length=600)

    @field_validator("severity", mode="before")
    @classmethod
    def _severity_fallback(cls, value: Any) -> Any:
        return value if value in ("info", "warning", "error") else "info"

    @field_validator("line", mode="before")
    @classmethod
    def _line_tolerant(cls, value: Any) -> int | None:
        return value if isinstance(value, int) and not isinstance(value, bool) and value >= 1 else None

    @field_validator("title", "detail", mode="before")
    @classmethod
    def _text_clean(cls, value: Any) -> Any:
        return clean_line(value) if isinstance(value, str) else value


class ComplexityInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")

    time: str = Field(min_length=1, max_length=80)
    space: str = Field(min_length=1, max_length=80)
    explanation: str = Field(min_length=1, max_length=700)

    @field_validator("time", "space", "explanation", mode="before")
    @classmethod
    def _text_clean(cls, value: Any) -> Any:
        return clean_line(value) if isinstance(value, str) else value


class CodeTestCase(BaseModel):
    """A suggested test. It has NOT been run: the expected output is reasoning, not a measured result."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    name: str = Field(min_length=1, max_length=100)
    input: str = Field(max_length=300)
    expected_output: str = Field(alias="expectedOutput", max_length=300)
    why: str = Field(default="", max_length=300)

    @field_validator("name", "input", "expected_output", "why", mode="before")
    @classmethod
    def _text_clean(cls, value: Any) -> Any:
        return clean_line(value) if isinstance(value, str) else ("" if value is None else str(value))


def _tolerant_list(value: Any, model: type[BaseModel], limit: int) -> list[Any]:
    """Keep only the items that validate; a broken item must not discard the rest."""
    if not isinstance(value, list):
        return []

    kept: list[Any] = []
    for item in value:
        try:
            kept.append(model.model_validate(item))
        except ValueError:
            continue
        if len(kept) >= limit:
            break
    return kept


class CodeModelOutput(BaseModel):
    """What the Coding Assistant must return. Strict on the summary, tolerant on every optional part."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    summary: str = Field(min_length=1, max_length=1200)
    findings: list[CodeFinding] = Field(default_factory=list)
    hints: list[str] = Field(default_factory=list)
    complexity: ComplexityInfo | None = None
    test_cases: list[CodeTestCase] = Field(default_factory=list, alias="testCases")
    improved_code: str | None = Field(default=None, alias="improvedCode", max_length=MAX_CODE_CHARS)
    follow_ups: list[str] = Field(default_factory=list, alias="followUps")

    @field_validator("summary", mode="before")
    @classmethod
    def _summary_clean(cls, value: Any) -> Any:
        if isinstance(value, str):
            cleaned = clean_multiline(value)
            if not cleaned:
                raise ValueError("Summary must not be blank.")
            return cleaned
        return value

    @field_validator("findings", mode="before")
    @classmethod
    def _findings_tolerant(cls, value: Any) -> list[Any]:
        return _tolerant_list(value, CodeFinding, MAX_FINDINGS)

    @field_validator("test_cases", mode="before")
    @classmethod
    def _tests_tolerant(cls, value: Any) -> list[Any]:
        return _tolerant_list(value, CodeTestCase, MAX_TEST_CASES)

    @field_validator("complexity", mode="before")
    @classmethod
    def _complexity_tolerant(cls, value: Any) -> Any:
        try:
            return ComplexityInfo.model_validate(value) if isinstance(value, dict) else None
        except ValueError:
            return None

    @field_validator("hints", "follow_ups", mode="before")
    @classmethod
    def _strings_tolerant(cls, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        cleaned = [clean_line(item)[:300] for item in value if isinstance(item, str)]
        return [item for item in cleaned if item]

    @field_validator("improved_code", mode="before")
    @classmethod
    def _improved_tolerant(cls, value: Any) -> str | None:
        if not isinstance(value, str):
            return None
        cleaned = clean_code(value)
        return cleaned if cleaned.strip() else None


class CodeAssistResponse(BaseModel):
    request_id: str = Field(alias="requestId")
    task: CodeTask
    code_language: str = Field(alias="codeLanguage")
    language: str
    help_mode: HelpMode = Field(alias="helpMode")
    summary: str
    findings: list[CodeFinding] = Field(default_factory=list)
    hints: list[str] = Field(default_factory=list)
    complexity: ComplexityInfo | None = None
    test_cases: list[CodeTestCase] = Field(default_factory=list, alias="testCases")
    improved_code: str | None = Field(default=None, alias="improvedCode")
    follow_ups: list[str] = Field(default_factory=list, alias="followUps")
    # This feature analyses code. These two flags are part of the contract so no client can imply otherwise.
    executed: Literal[False] = False
    verified: Literal[False] = False
    review: ReviewResult | None = None
    trace: list[TraceEntry] = Field(default_factory=list)
    model_calls: int = Field(default=0, alias="modelCalls")

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())
