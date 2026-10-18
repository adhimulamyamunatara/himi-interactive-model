"""Tutor Orchestrator: runs one student request through the workflow inside a hard execution budget.

    route (rules) -> [clarify | handoff]            no model call
                  -> subject tutor (1 model call) -> review (rules) -> [one regeneration if flagged]

Agents never call other agents or the orchestrator, so there is no recursion. The whole request is capped at
``MAX_MODEL_CALLS`` model calls, ``MAX_DEPTH`` levels and ``DEADLINE_SECONDS`` of wall-clock time. Logs and the
returned trace contain only agent names, statuses and timings, never the student's text or model output.
"""

from __future__ import annotations

import logging
import time
import uuid

from app.agents import reviewer, subject_tutor
from app.agents.base import AgentError, ExecutionBudget, TraceRecorder
from app.agents.router import RouteDecision, classify_intent
from app.schemas.tutor import (
    MAX_ACTIONS,
    Clarification,
    Handoff,
    SuggestedAction,
    TutorModelOutput,
    TutorRequest,
    TutorResponse,
)

logger = logging.getLogger(__name__)

ANSWER_INTENTS = ("explain", "hint", "worked_example", "revision")
# Intents answered by handing the student to the matching tool instead of a model call.
HANDOFF_KINDS = {"quiz": "quiz", "planner": "planner", "code_help": "code", "visual": "diagram"}


def _with_default_actions(request: TutorRequest, output: TutorModelOutput) -> list[SuggestedAction]:
    """Model suggestions plus a quiz check, since a quiz is the cheapest honest way to test understanding."""
    actions = list(output.suggested_actions)

    if not any(action.kind == "quiz" for action in actions):
        actions.append(SuggestedAction(kind="quiz", topic=request.topic))

    return actions[:MAX_ACTIONS]


def _base_response(request: TutorRequest, request_id: str, decision: RouteDecision, agent: str, budget: ExecutionBudget, trace: TraceRecorder, **fields) -> TutorResponse:
    return TutorResponse(
        requestId=request_id,
        intent=decision.intent,
        agent=agent,
        language=request.language,
        helpMode=request.helpMode,
        trace=trace.entries,
        modelCalls=budget.model_calls,
        **fields,
    )


def run_tutor(request: TutorRequest) -> TutorResponse:
    """Run the workflow. Raises ``AgentError`` subclasses (with safe messages) on provider or output failures."""
    request_id = uuid.uuid4().hex[:12]
    started = time.monotonic()
    budget = ExecutionBudget()
    trace = TraceRecorder()

    routed_at = time.monotonic()
    decision = classify_intent(request)
    trace.record("orchestrator", f"route:{decision.intent}", "ok", routed_at)

    try:
        if decision.intent == "clarify":
            trace.record("subject_tutor", "respond", "skipped")
            return _base_response(
                request, request_id, decision, "orchestrator", budget, trace,
                outcome="clarify", clarify=Clarification(reason="too_vague"),
            )

        if decision.intent in HANDOFF_KINDS:
            # Another HIMI tool does this better than a chat answer, so no model call is spent here.
            trace.record("subject_tutor", "respond", "skipped")
            return _base_response(
                request, request_id, decision, "orchestrator", budget, trace,
                outcome="handoff",
                handoff=Handoff(kind=HANDOFF_KINDS[decision.intent], subject=request.subject, topic=decision.topic),
            )

        output = subject_tutor.run(request, decision.intent, budget=budget, trace=trace)
        reviewed_at = time.monotonic()
        review = reviewer.review_answer(request, decision.intent, output)
        trace.record("reviewer", "structure_check", "ok" if review.passed else "flagged", reviewed_at)

        if not review.passed and budget.can_call_model():
            try:
                retry_output = subject_tutor.run(request, decision.intent, budget=budget, trace=trace, feedback=review.issues)
                retry_review = reviewer.review_answer(request, decision.intent, retry_output)
                trace.record("reviewer", "structure_check", "ok" if retry_review.passed else "flagged")
                # Keep the regeneration only if it is no worse than the first answer.
                if len(retry_review.issues) <= len(review.issues):
                    output, review = retry_output, retry_review
            except AgentError:
                # The first answer is still usable; it is returned with its flagged review.
                trace.record("subject_tutor", "regenerate", "fallback")

        return _base_response(
            request, request_id, decision, subject_tutor.AGENT_NAME, budget, trace,
            outcome="answer",
            answer=output.answer,
            plan=output.plan,
            followUps=output.follow_ups,
            clarifyingQuestion=output.clarifying_question,
            suggestedActions=_with_default_actions(request, output),
            review=review,
        )
    finally:
        logger.info(
            "tutor request=%s intent=%s reason=%s model_calls=%d steps=%d ms=%d",
            request_id, decision.intent, decision.reason, budget.model_calls, len(trace.entries),
            int((time.monotonic() - started) * 1000),
        )
