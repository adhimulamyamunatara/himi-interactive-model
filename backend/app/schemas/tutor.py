"""Request, model-output and response contracts for the AI tutor (the multi-agent workflow).

Everything the model returns is untrusted and is validated against ``TutorModelOutput`` before it is used.
Nothing in here is stored: requests carry the bits of context the browser chose to send.
"""

from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.subjects import SUBJECTS
from app.schemas.learning_profile import LearningProfile

# UI language is separate from the explanation language. Add a code here (and a prompt entry) to support more.
SUPPORTED_LANGUAGES: dict[str, str] = {"en": "English", "te": "Telugu"}

MAX_MESSAGE_CHARS = 2000
MAX_TOPIC_CHARS = 80
MAX_HISTORY_TURNS = 6
MAX_HISTORY_CHARS = 1500
MAX_ANSWER_CHARS = 6000
MAX_PLAN_STEPS = 6
MAX_FOLLOW_UPS = 3
MAX_ACTIONS = 3

Intent = Literal["explain", "hint", "worked_example", "revision", "quiz", "planner", "clarify"]
HelpMode = Literal["hint", "guided", "full"]
Outcome = Literal["answer", "clarify", "handoff"]
StepKind = Literal["learn", "example", "practice", "check"]
# Actions map to existing HIMI tools. Anything else the model invents is dropped.
ActionKind = Literal["quiz", "planner", "notes", "whiteboard", "diagram"]
TraceStatus = Literal["ok", "skipped", "retry", "flagged", "fallback"]

_CONTROL_CHARACTERS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")


def clean_multiline(text: str) -> str:
    """Strip control characters but keep newlines and tabs (code and Markdown need them)."""
    return _CONTROL_CHARACTERS.sub("", text).strip()


def clean_line(text: str) -> str:
    return re.sub(r"\s+", " ", _CONTROL_CHARACTERS.sub(" ", text)).strip()


class HistoryTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_HISTORY_CHARS)

    @field_validator("content")
    @classmethod
    def _content_not_blank(cls, value: str) -> str:
        cleaned = clean_multiline(value)
        if not cleaned:
            raise ValueError("History content must not be blank.")
        return cleaned


class ProgressSummary(BaseModel):
    """Figures the browser computed from the student's own recorded quiz attempts (never estimated by the AI)."""

    model_config = ConfigDict(extra="forbid")

    attempts: int = Field(ge=0, le=100000)
    average_percent: int | None = Field(default=None, ge=0, le=100, alias="averagePercent")
    weak_topics: list[str] = Field(default_factory=list, max_length=5, alias="weakTopics")

    @field_validator("weak_topics")
    @classmethod
    def _weak_topics_clean(cls, value: list[str]) -> list[str]:
        cleaned = [clean_line(item)[:MAX_TOPIC_CHARS] for item in value]
        return [item for item in cleaned if item]


class TutorRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)
    subject: str = Field(min_length=1, max_length=60)
    topic: str | None = Field(default=None, max_length=MAX_TOPIC_CHARS)
    userName: str = Field(min_length=1, max_length=60)
    # Language the explanation is written in (not the UI language).
    language: str = "en"
    helpMode: HelpMode = "guided"
    history: list[HistoryTurn] = Field(default_factory=list, max_length=MAX_HISTORY_TURNS)
    progress: ProgressSummary | None = None
    learningProfile: LearningProfile | None = None

    @field_validator("message")
    @classmethod
    def _message_clean(cls, value: str) -> str:
        cleaned = clean_multiline(value)
        if not cleaned:
            raise ValueError("Message must not be blank.")
        return cleaned

    @field_validator("userName")
    @classmethod
    def _name_clean(cls, value: str) -> str:
        cleaned = clean_line(value)
        if not cleaned:
            raise ValueError("Name must not be blank.")
        return cleaned

    @field_validator("topic")
    @classmethod
    def _topic_clean(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = clean_line(value)
        return cleaned or None

    @field_validator("subject")
    @classmethod
    def _subject_supported(cls, value: str) -> str:
        if value not in SUBJECTS:
            raise ValueError("Unsupported subject.")
        return value

    @field_validator("language")
    @classmethod
    def _language_supported(cls, value: str) -> str:
        if value not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported language. Supported: {', '.join(SUPPORTED_LANGUAGES)}.")
        return value


class PlanStep(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str = Field(min_length=1, max_length=100)
    detail: str = Field(min_length=1, max_length=500)
    kind: StepKind = "learn"

    @field_validator("title", "detail")
    @classmethod
    def _clean(cls, value: str) -> str:
        cleaned = clean_line(value)
        if not cleaned:
            raise ValueError("Plan text must not be blank.")
        return cleaned

    @field_validator("kind", mode="before")
    @classmethod
    def _kind_fallback(cls, value: Any) -> Any:
        return value if value in ("learn", "example", "practice", "check") else "learn"


class TutorPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")

    goal: str = Field(min_length=1, max_length=250)
    steps: list[PlanStep] = Field(min_length=1, max_length=MAX_PLAN_STEPS)

    @field_validator("goal")
    @classmethod
    def _goal_clean(cls, value: str) -> str:
        cleaned = clean_line(value)
        if not cleaned:
            raise ValueError("Goal must not be blank.")
        return cleaned


class SuggestedAction(BaseModel):
    model_config = ConfigDict(extra="ignore")

    kind: ActionKind
    # Optional because deterministic suggestions are labelled by the UI in the interface language.
    label: str | None = Field(default=None, max_length=80)
    topic: str | None = Field(default=None, max_length=MAX_TOPIC_CHARS)

    @field_validator("label", "topic")
    @classmethod
    def _clean(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = clean_line(value)
        return cleaned or None


class TutorModelOutput(BaseModel):
    """What the Subject Tutor must return. Strict on the answer and plan, tolerant on the optional extras."""

    model_config = ConfigDict(extra="ignore")

    answer: str = Field(min_length=1, max_length=MAX_ANSWER_CHARS)
    plan: TutorPlan
    follow_ups: list[str] = Field(default_factory=list, alias="followUps")
    clarifying_question: str | None = Field(default=None, alias="clarifyingQuestion", max_length=300)
    suggested_actions: list[SuggestedAction] = Field(default_factory=list, alias="suggestedActions")

    @field_validator("answer")
    @classmethod
    def _answer_clean(cls, value: str) -> str:
        cleaned = clean_multiline(value)
        if not cleaned:
            raise ValueError("Answer must not be blank.")
        return cleaned

    @field_validator("follow_ups", mode="before")
    @classmethod
    def _follow_ups_tolerant(cls, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        cleaned = [clean_line(item)[:160] for item in value if isinstance(item, str)]
        return [item for item in cleaned if item][:MAX_FOLLOW_UPS]

    @field_validator("clarifying_question", mode="before")
    @classmethod
    def _clarifying_tolerant(cls, value: Any) -> str | None:
        if not isinstance(value, str):
            return None
        cleaned = clean_line(value)[:300]
        return cleaned or None

    @field_validator("suggested_actions", mode="before")
    @classmethod
    def _actions_tolerant(cls, value: Any) -> list[Any]:
        """Drop malformed or unknown actions instead of failing the whole answer."""
        if not isinstance(value, list):
            return []
        valid: list[Any] = []
        seen: set[str] = set()
        for item in value:
            if not isinstance(item, dict) or item.get("kind") not in ("quiz", "planner", "notes", "whiteboard", "diagram"):
                continue
            if item["kind"] in seen:
                continue
            seen.add(item["kind"])
            valid.append(item)
        return valid[:MAX_ACTIONS]


class ReviewResult(BaseModel):
    """Outcome of the automated structure check. It does not verify facts."""

    passed: bool
    issues: list[str] = Field(default_factory=list)


class TraceEntry(BaseModel):
    """One safe, non-sensitive step of the workflow (never contains the student's text or model output)."""

    agent: str
    action: str
    status: TraceStatus
    ms: int = Field(ge=0)


class Clarification(BaseModel):
    reason: Literal["too_vague"]


class Handoff(BaseModel):
    kind: Literal["quiz", "planner"]
    subject: str
    topic: str | None = None


class TutorResponse(BaseModel):
    request_id: str = Field(alias="requestId")
    outcome: Outcome
    intent: Intent
    agent: str
    language: str
    help_mode: HelpMode = Field(alias="helpMode")
    answer: str | None = None
    plan: TutorPlan | None = None
    follow_ups: list[str] = Field(default_factory=list, alias="followUps")
    clarifying_question: str | None = Field(default=None, alias="clarifyingQuestion")
    suggested_actions: list[SuggestedAction] = Field(default_factory=list, alias="suggestedActions")
    clarify: Clarification | None = None
    handoff: Handoff | None = None
    review: ReviewResult | None = None
    trace: list[TraceEntry] = Field(default_factory=list)
    model_calls: int = Field(default=0, alias="modelCalls")

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())
