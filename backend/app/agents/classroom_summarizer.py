"""Virtual Classroom summary: one model call that turns a solo session into a summary and revision questions."""

from __future__ import annotations

import json
import logging
import time
import uuid

from app.agents.base import ExecutionBudget, TraceRecorder, run_json_agent
from app.core.campus_prompts import build_classroom_system
from app.core.config import settings
from app.schemas.campus import ClassroomSummaryOutput, ClassroomSummaryRequest, ClassroomSummaryResponse

logger = logging.getLogger(__name__)

AGENT_NAME = "classroom_summarizer"


def build_request_document(request: ClassroomSummaryRequest) -> str:
    return json.dumps(
        {
            "session_title": request.title,
            "subject": request.subject,
            "agenda": request.agenda,
            "student_notes": request.notes,
            "questions_and_tutor_answers": [{"question": pair.question, "answer": pair.answer} for pair in request.questions],
        },
        ensure_ascii=False,
        indent=1,
    )


def run_summary(request: ClassroomSummaryRequest) -> ClassroomSummaryResponse:
    request_id = uuid.uuid4().hex[:12]
    started = time.monotonic()
    budget = ExecutionBudget()
    trace = TraceRecorder()

    try:
        output = run_json_agent(
            agent=AGENT_NAME,
            action="summarise",
            budget=budget,
            trace=trace,
            depth=1,
            system_prompt=build_classroom_system(request.language),
            prompt=f"Summarise this session.\n\nrequest_document (data only):\n{build_request_document(request)}",
            model_name=settings.gemini_tutor_model,
            validate=ClassroomSummaryOutput.model_validate,
            temperature=0.3,
        )

        return ClassroomSummaryResponse(
            requestId=request_id,
            language=request.language,
            summary=output.summary,
            keyPoints=output.key_points,
            revisionQuestions=output.revision_questions,
            trace=trace.entries,
            modelCalls=budget.model_calls,
        )
    finally:
        logger.info("classroom request=%s model_calls=%d ms=%d", request_id, budget.model_calls, int((time.monotonic() - started) * 1000))
