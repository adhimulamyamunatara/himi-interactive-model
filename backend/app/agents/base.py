"""Shared plumbing for agents: the execution budget, the safe trace, and a validated-JSON model call."""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Callable, TypeVar

from pydantic import ValidationError

from app.schemas.tutor import TraceEntry
from app.services.gemini_service import (
    GeminiConfigError,
    GeminiRequestError,
    GeminiTimeoutError,
    generate_text,
)

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Hard ceilings for one student request. Agents cannot call other agents, so depth never exceeds 2.
MAX_MODEL_CALLS = 3
MAX_DEPTH = 2
DEADLINE_SECONDS = 100.0
PER_CALL_TIMEOUT_SECONDS = 45.0
MAX_ATTEMPTS_PER_AGENT = 2

_FENCE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL | re.IGNORECASE)


class AgentError(Exception):
    """Base class for failures the API layer turns into HTTP responses. Messages here are safe to show."""

    status_code = 500
    public_message = "The tutor could not complete this request. Please try again."


class AgentUnavailableError(AgentError):
    status_code = 503
    public_message = "The AI tutor is not available right now. Please try again later."


class AgentTimeoutError(AgentError):
    status_code = 504
    public_message = "The tutor took too long to answer. Please try again."


class AgentOutputError(AgentError):
    status_code = 502
    public_message = "HIMI couldn't produce a valid answer this time. Please try again."


class BudgetExceededError(AgentError):
    status_code = 502
    public_message = "This request needed more steps than HIMI allows. Try asking a smaller question."


@dataclass
class ExecutionBudget:
    """Bounds the work done for one request: model calls, nesting depth and wall-clock time."""

    max_model_calls: int = MAX_MODEL_CALLS
    max_depth: int = MAX_DEPTH
    deadline_seconds: float = DEADLINE_SECONDS
    started: float = field(default_factory=time.monotonic)
    model_calls: int = 0

    def remaining_seconds(self) -> float:
        return self.deadline_seconds - (time.monotonic() - self.started)

    def check_depth(self, depth: int) -> None:
        if depth > self.max_depth:
            raise BudgetExceededError("Maximum agent depth exceeded.")

    def can_call_model(self) -> bool:
        return self.model_calls < self.max_model_calls and self.remaining_seconds() > 5

    def spend_model_call(self) -> None:
        if not self.can_call_model():
            raise BudgetExceededError("Model call budget exhausted.")
        self.model_calls += 1


class TraceRecorder:
    """Collects the workflow steps. Only agent names, actions, statuses and timings are ever recorded."""

    def __init__(self) -> None:
        self.entries: list[TraceEntry] = []

    def record(self, agent: str, action: str, status: str, started: float | None = None) -> None:
        ms = int((time.monotonic() - started) * 1000) if started is not None else 0
        self.entries.append(TraceEntry(agent=agent, action=action, status=status, ms=max(ms, 0)))  # type: ignore[arg-type]


def parse_model_json(raw_text: str) -> Any:
    """Parse model output as JSON, tolerating a Markdown fence or surrounding prose."""
    text = raw_text.strip()
    fenced = _FENCE.match(text)

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

    raise ValueError("Model output is not valid JSON.")


def run_json_agent(
    *,
    agent: str,
    action: str,
    budget: ExecutionBudget,
    trace: TraceRecorder,
    depth: int,
    system_prompt: str,
    prompt: str,
    model_name: str,
    validate: Callable[[Any], T],
    temperature: float = 0.4,
    images: list[tuple[str, bytes]] | None = None,
) -> T:
    """Call the model for ``agent`` and return validated output.

    Retries only when the output is malformed (at most ``MAX_ATTEMPTS_PER_AGENT`` attempts, each of which spends
    from the shared budget). Provider failures are not retried.
    """
    budget.check_depth(depth)

    for attempt in range(1, MAX_ATTEMPTS_PER_AGENT + 1):
        started = time.monotonic()
        budget.spend_model_call()

        # Only pass images when there are some, so text-only agents call the model exactly as before.
        extra = {"images": images} if images else {}

        try:
            raw = generate_text(
                prompt,
                system_instruction=system_prompt,
                json_output=True,
                temperature=temperature,
                timeout_seconds=max(5.0, min(PER_CALL_TIMEOUT_SECONDS, budget.remaining_seconds())),
                model_name=model_name,
                **extra,
            )
        except GeminiConfigError as exc:
            logger.error("Agent %s unavailable: %s", agent, exc)
            raise AgentUnavailableError() from exc
        except GeminiTimeoutError as exc:
            logger.warning("Agent %s timed out (attempt %d).", agent, attempt)
            raise AgentTimeoutError() from exc
        except GeminiRequestError as exc:
            logger.error("Agent %s provider failure (attempt %d): %s", agent, attempt, exc)
            raise AgentOutputError() from exc

        try:
            result = validate(parse_model_json(raw))
        except (ValueError, ValidationError) as exc:
            # The message describes the contract problem only; it never contains the student's text or the output.
            logger.warning("Agent %s produced invalid output (attempt %d/%d): %s", agent, attempt, MAX_ATTEMPTS_PER_AGENT, type(exc).__name__)
            trace.record(agent, action, "retry", started)
            continue

        trace.record(agent, action, "ok", started)
        return result

    raise AgentOutputError()
