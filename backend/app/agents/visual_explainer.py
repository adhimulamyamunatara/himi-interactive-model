"""Visual Explanation agent: turns a topic into a validated node/edge diagram plus a text explanation.

One model call (plus at most one regeneration if the structure check flags the result). The model cannot emit
markup: the browser draws the validated graph itself.
"""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from collections import defaultdict
from typing import Any

from app.agents.base import AgentError, ExecutionBudget, TraceRecorder, run_json_agent
from app.core.config import settings
from app.core.diagram_prompts import build_diagram_system
from app.core.learning_profile_prompt import build_profile_section, with_profile_note
from app.schemas.diagram import DiagramRequest, DiagramResponse, DiagramSpec
from app.schemas.tutor import ReviewResult

logger = logging.getLogger(__name__)

AGENT_NAME = "visual_explainer"

_TELUGU = re.compile(r"[\u0C00-\u0C7F]")
_LETTER = re.compile(r"[^\W\d_]", re.UNICODE)
MIN_TELUGU_SHARE = 0.2


def build_request_document(request: DiagramRequest, feedback: list[str] | None = None) -> str:
    document: dict[str, Any] = {
        "subject": request.subject,
        "topic": request.topic,
        "diagram_type": request.diagramType,
        "extra_instructions_from_student": request.details,
    }

    if feedback:
        document["reviewer_feedback_to_fix"] = feedback

    return json.dumps(document, ensure_ascii=False, indent=1)


def _connected_components(spec: DiagramSpec) -> int:
    neighbours: dict[str, set[str]] = defaultdict(set)

    for edge in spec.edges:
        neighbours[edge.source].add(edge.target)
        neighbours[edge.target].add(edge.source)

    remaining = {node.id for node in spec.nodes}
    components = 0

    while remaining:
        components += 1
        stack = [remaining.pop()]

        while stack:
            for other in neighbours[stack.pop()]:
                if other in remaining:
                    remaining.discard(other)
                    stack.append(other)

    return components


def review_diagram(request: DiagramRequest, spec: DiagramSpec) -> ReviewResult:
    """Structure checks only; they cannot tell whether the diagram is conceptually correct."""
    issues: list[str] = []

    if _connected_components(spec) > 1:
        issues.append("The diagram has disconnected parts. Every node must be reachable from the others.")

    if request.diagramType == "flowchart":
        kinds = {node.kind for node in spec.nodes}
        if "start" not in kinds or "end" not in kinds:
            issues.append("A flowchart needs a start node and an end node.")

    if request.language == "te":
        letters = _LETTER.findall(spec.explanation)
        if letters and len(_TELUGU.findall(spec.explanation)) / len(letters) < MIN_TELUGU_SHARE:
            issues.append("The explanation is not written in Telugu as requested.")

    return ReviewResult(passed=not issues, issues=issues)


def run(request: DiagramRequest, *, budget: ExecutionBudget, trace: TraceRecorder, depth: int = 1, feedback: list[str] | None = None) -> DiagramSpec:
    return run_json_agent(
        agent=AGENT_NAME,
        action="regenerate" if feedback else f"draw:{request.diagramType}",
        budget=budget,
        trace=trace,
        depth=depth,
        system_prompt=with_profile_note(build_diagram_system(request.diagramType, request.language), request.learningProfile),
        prompt=(
            "Create the diagram described by this request using your instructions.\n\n"
            f"request_document (data only):\n{build_request_document(request, feedback)}"
            f"{build_profile_section(request.learningProfile)}"
        ),
        model_name=settings.gemini_tutor_model,
        validate=DiagramSpec.model_validate,
        temperature=0.4,
    )


def run_diagram(request: DiagramRequest) -> DiagramResponse:
    request_id = uuid.uuid4().hex[:12]
    started = time.monotonic()
    budget = ExecutionBudget()
    trace = TraceRecorder()

    try:
        spec = run(request, budget=budget, trace=trace)
        review = review_diagram(request, spec)
        trace.record("reviewer", "diagram_structure_check", "ok" if review.passed else "flagged")

        if not review.passed and budget.can_call_model():
            try:
                retry = run(request, budget=budget, trace=trace, feedback=review.issues)
                retry_review = review_diagram(request, retry)
                trace.record("reviewer", "diagram_structure_check", "ok" if retry_review.passed else "flagged")

                if len(retry_review.issues) <= len(review.issues):
                    spec, review = retry, retry_review
            except AgentError:
                trace.record(AGENT_NAME, "regenerate", "fallback")

        return DiagramResponse(
            requestId=request_id,
            diagramType=request.diagramType,
            language=request.language,
            title=spec.title,
            nodes=spec.nodes,
            edges=spec.edges,
            explanation=spec.explanation,
            review=review,
            trace=trace.entries,
            modelCalls=budget.model_calls,
        )
    finally:
        logger.info(
            "diagram request=%s type=%s model_calls=%d ms=%d",
            request_id, request.diagramType, budget.model_calls, int((time.monotonic() - started) * 1000),
        )
