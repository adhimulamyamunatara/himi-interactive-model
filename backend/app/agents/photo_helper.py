"""Photo Helper agent: explains or transcribes one still photo of study material that the student chose to send.

One model call (plus at most one regeneration if the structure check flags the result). The image is passed to the
model for this request only; it is never stored, and neither the image nor the model's text is written to the logs.
"""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from typing import Any

from app.agents.base import AgentError, ExecutionBudget, TraceRecorder, run_json_agent
from app.core.camera_prompts import build_camera_system
from app.core.config import settings
from app.core.learning_profile_prompt import build_profile_section, with_profile_note
from app.schemas.camera import (
    MAX_FOLLOW_UPS,
    MAX_KEY_POINTS,
    CameraAnalyzeRequest,
    CameraAnalyzeResponse,
    CameraModelOutput,
)
from app.schemas.tutor import ReviewResult

logger = logging.getLogger(__name__)

AGENT_NAME = "photo_helper"
NOT_STUDY_MAX_CHARS = 400
MIN_TELUGU_SHARE = 0.2

_TELUGU = re.compile(r"[\u0C00-\u0C7F]")
_LETTER = re.compile(r"[^\W\d_]", re.UNICODE)


def build_request_document(request: CameraAnalyzeRequest, feedback: list[str] | None = None) -> str:
    document: dict[str, Any] = {
        "task": request.task,
        "subject_hint": request.subject,
        "student_question_about_the_photo": request.question,
    }
    if feedback:
        document["reviewer_feedback_to_fix"] = feedback
    return json.dumps(document, ensure_ascii=False, indent=1)


def shape_output(output: CameraModelOutput, request: CameraAnalyzeRequest) -> CameraModelOutput:
    """Enforce what each situation may contain, whatever the model returned."""
    data = output.model_dump()
    data["keyPoints"] = data["keyPoints"][:MAX_KEY_POINTS]
    data["followUps"] = data["followUps"][:MAX_FOLLOW_UPS]

    if request.task == "transcribe":
        data["keyPoints"] = []

    if output.legibility == "unreadable":
        # Nothing reliable can be extracted, so do not present guesses as text or key points.
        data["extractedText"] = None
        data["keyPoints"] = []

    if output.kind == "not_study_material":
        # A photo of a person or a room gets a short refusal only: no description, no text, no points.
        data.update(extractedText=None, keyPoints=[], followUps=[], whatIsShown="", explanation=output.explanation[:NOT_STUDY_MAX_CHARS])

    return CameraModelOutput.model_validate(data)


def review_output(request: CameraAnalyzeRequest, output: CameraModelOutput) -> ReviewResult:
    """Structure checks only; they cannot tell whether the explanation is correct."""
    issues: list[str] = []

    if not output.explanation.strip():
        issues.append("The explanation is empty.")

    if request.language == "te" and output.explanation:
        letters = _LETTER.findall(output.explanation)
        if letters and len(_TELUGU.findall(output.explanation)) / len(letters) < MIN_TELUGU_SHARE:
            issues.append("The explanation is not written in Telugu as requested.")

    return ReviewResult(passed=not issues, issues=issues)


def run(request: CameraAnalyzeRequest, image: bytes, *, budget: ExecutionBudget, trace: TraceRecorder, depth: int = 1, feedback: list[str] | None = None) -> CameraModelOutput:
    return run_json_agent(
        agent=AGENT_NAME,
        action="regenerate" if feedback else f"look:{request.task}",
        budget=budget,
        trace=trace,
        depth=depth,
        system_prompt=with_profile_note(build_camera_system(request.task, request.helpMode, request.language), request.learningProfile),
        prompt=(
            "Look at the attached photo and respond using your instructions.\n\n"
            f"request_document (data only):\n{build_request_document(request, feedback)}"
            f"{build_profile_section(request.learningProfile)}"
        ),
        model_name=settings.gemini_tutor_model,
        validate=CameraModelOutput.model_validate,
        temperature=0.3,
        images=[(request.mimeType, image)],
    )


def run_photo(request: CameraAnalyzeRequest, image: bytes) -> CameraAnalyzeResponse:
    request_id = uuid.uuid4().hex[:12]
    started = time.monotonic()
    budget = ExecutionBudget()
    trace = TraceRecorder()

    try:
        output = shape_output(run(request, image, budget=budget, trace=trace), request)
        review = review_output(request, output)
        trace.record("reviewer", "photo_structure_check", "ok" if review.passed else "flagged")

        if not review.passed and budget.can_call_model():
            try:
                retry = shape_output(run(request, image, budget=budget, trace=trace, feedback=review.issues), request)
                retry_review = review_output(request, retry)
                trace.record("reviewer", "photo_structure_check", "ok" if retry_review.passed else "flagged")

                if len(retry_review.issues) <= len(review.issues):
                    output, review = retry, retry_review
            except AgentError:
                trace.record(AGENT_NAME, "regenerate", "fallback")

        return CameraAnalyzeResponse(
            requestId=request_id,
            task=request.task,
            language=request.language,
            title=output.title or "Your photo",
            kind=output.kind,
            legibility=output.legibility,
            whatIsShown=output.whatIsShown,
            extractedText=output.extractedText,
            explanation=output.explanation,
            keyPoints=output.keyPoints,
            followUps=output.followUps,
            review=review,
            trace=trace.entries,
            modelCalls=budget.model_calls,
        )
    finally:
        # Sizes and timings only. Never the image, the question or the model's text.
        logger.info(
            "camera request=%s task=%s bytes=%d model_calls=%d ms=%d",
            request_id, request.task, len(image), budget.model_calls, int((time.monotonic() - started) * 1000),
        )
