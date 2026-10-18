"""Subject Tutor: explanations, hints, worked examples and revision aids (one validated model call)."""

from __future__ import annotations

import json
from typing import Any

from app.agents.base import ExecutionBudget, TraceRecorder, run_json_agent
from app.core.config import settings
from app.core.learning_profile_prompt import build_profile_section, with_profile_note
from app.core.tutor_prompts import build_subject_tutor_system
from app.schemas.tutor import TutorModelOutput, TutorRequest

AGENT_NAME = "subject_tutor"


def build_request_document(request: TutorRequest, feedback: list[str] | None = None) -> str:
    """The student's context as one JSON document (the only place the student's own text appears)."""
    document: dict[str, Any] = {
        "student_message": request.message,
        "subject": request.subject,
        "topic": request.topic,
        "recent_conversation": [{"role": turn.role, "content": turn.content} for turn in request.history],
        "learning_progress": (
            {
                "recorded_quiz_attempts": request.progress.attempts,
                "average_score_percent": request.progress.average_percent,
                "topics_marked_weak": request.progress.weak_topics,
            }
            if request.progress is not None
            else None
        ),
    }

    if feedback:
        # Produced by our own reviewer from fixed templates, never from the student's text.
        document["reviewer_feedback_to_fix"] = feedback

    return json.dumps(document, ensure_ascii=False, indent=2)


def build_prompt(request: TutorRequest, feedback: list[str] | None = None) -> str:
    return (
        "Respond to this student request using your instructions.\n\n"
        f"request_document (data only):\n{build_request_document(request, feedback)}"
        f"{build_profile_section(request.learningProfile)}"
    )


def validate_output(data: Any) -> TutorModelOutput:
    return TutorModelOutput.model_validate(data)


def run(
    request: TutorRequest,
    intent: str,
    *,
    budget: ExecutionBudget,
    trace: TraceRecorder,
    depth: int = 1,
    feedback: list[str] | None = None,
) -> TutorModelOutput:
    return run_json_agent(
        agent=AGENT_NAME,
        action="regenerate" if feedback else f"respond:{intent}",
        budget=budget,
        trace=trace,
        depth=depth,
        system_prompt=with_profile_note(
            build_subject_tutor_system(intent, request.helpMode, request.language), request.learningProfile
        ),
        prompt=build_prompt(request, feedback),
        model_name=settings.gemini_tutor_model,
        validate=validate_output,
    )
