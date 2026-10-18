"""Tutor Orchestrator, step 1: decide what the student needs, with plain rules (no model call).

Deterministic routing keeps the common cases fast and cheap, makes the decision explainable and testable, and
means the model is only used when it genuinely adds value. Quiz and planner requests are handed to the existing
HIMI tools instead of being answered by the model.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.schemas.tutor import MAX_TOPIC_CHARS, Intent, TutorRequest, clean_line

_QUIZ = re.compile(
    r"\b(quiz me|test me|take (a|the) quiz|give me (a )?quiz|make (me )?a quiz|create (a )?quiz|practice (test|questions)|mock test)\b|క్విజ్",
    re.IGNORECASE,
)
_PLANNER = re.compile(
    r"\b(study plan|revision plan|make (me )?a plan|create (a )?plan|plan my|timetable|study schedule|exam schedule)\b|ప్రణాళిక|ప్లాన్",
    re.IGNORECASE,
)
_REVISION = re.compile(
    r"\b(revise|revision|recap|cheat ?sheet|flash ?cards?|quick summary|key points|last[- ]minute)\b",
    re.IGNORECASE,
)
_HINT = re.compile(
    r"\b(hint|clue|nudge|give me a push|don'?t (give|tell) me the (answer|solution)|without (the )?(answer|solution))\b|సూచన",
    re.IGNORECASE,
)
_EXAMPLE = re.compile(
    r"\b(worked example|walk me through|work through|solve|numerical|step[- ]by[- ]step (solution|example)|example of|an example)\b|ఉదాహరణ",
    re.IGNORECASE,
)

# Words that carry no subject matter. A message made only of these needs a follow-up question.
_FILLER = frozenset(
    "a an and about can could do does explain for give help how i is it me my of on please show something tell "
    "teach that the this to understand what why with you dont don't hi hello hey ok okay yes no thanks thank".split()
)

_TOPIC_PREFIX = re.compile(
    r"^(please\s+)?(can you\s+)?("
    r"quiz me|test me|give me (a )?quiz|make (me )?a (quiz|study plan|revision plan|plan|schedule)|"
    r"create (a )?(study plan|revision plan|quiz|plan)|take (a|the) quiz|plan my|i want (a )?(quiz|study plan)"
    r")\s*(on|about|for|of)?\s*",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class RouteDecision:
    intent: Intent
    # Short stable code describing which rule fired (safe to log).
    reason: str
    topic: str | None = None


def _content_words(message: str) -> list[str]:
    words = re.findall(r"[^\W_]+(?:'[^\W_]+)?", message.lower(), flags=re.UNICODE)
    return [word for word in words if word not in _FILLER]


def is_too_vague(request: TutorRequest) -> bool:
    """True when there is nothing to teach yet: no topic, and no words beyond filler."""
    return request.topic is None and not _content_words(request.message)


def extract_topic(request: TutorRequest) -> str | None:
    """Best-effort topic for a handoff: what is left of the message after the request phrase, else the chosen topic."""
    remainder = _TOPIC_PREFIX.sub("", request.message.strip(), count=1)
    remainder = clean_line(remainder).strip(" .?!,:;")

    if remainder and remainder.lower() != request.message.strip().lower() and len(_content_words(remainder)) > 0:
        return remainder[:MAX_TOPIC_CHARS]

    return request.topic


def classify_intent(request: TutorRequest) -> RouteDecision:
    message = request.message

    if is_too_vague(request):
        return RouteDecision("clarify", "too_vague")

    if _QUIZ.search(message):
        return RouteDecision("quiz", "quiz_phrase", extract_topic(request))

    if _PLANNER.search(message):
        return RouteDecision("planner", "planner_phrase", extract_topic(request))

    if request.helpMode == "hint" or _HINT.search(message):
        return RouteDecision("hint", "hint_requested")

    if _REVISION.search(message):
        return RouteDecision("revision", "revision_phrase")

    if _EXAMPLE.search(message):
        return RouteDecision("worked_example", "example_phrase")

    return RouteDecision("explain", "default_explain")
