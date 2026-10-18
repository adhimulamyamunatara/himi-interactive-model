"""Coding Assistant: static analysis of student code (explain, debug, hints, complexity, test ideas).

The code is NEVER executed here or anywhere else: it is placed in a JSON document and read by the model. The
output is shaped by the task and help mode after validation (so a hint request cannot return a full solution
even if the model ignores its instructions), and a rule-based check rejects claims that code was run or tested.
"""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from typing import Any

from app.agents.base import AgentError, ExecutionBudget, TraceRecorder, run_json_agent
from app.core.code_prompts import build_code_system
from app.core.config import settings
from app.core.learning_profile_prompt import build_profile_section, with_profile_note
from app.schemas.code import CODE_LANGUAGES, CodeAssistRequest, CodeAssistResponse, CodeModelOutput
from app.schemas.tutor import ReviewResult

logger = logging.getLogger(__name__)

AGENT_NAME = "coding_assistant"

# Phrases that would present analysis as if the code had been run. Matched against every text field of the output.
_EXECUTION_CLAIM = re.compile(
    r"\b("
    r"i (have )?(ran|run|executed|compiled|tested|checked by running)|"
    r"we (ran|executed|compiled|tested)|"
    r"(after|when) (i |we )?(running|executing|compiling) (it|the code|your code)|"
    r"(all|every) (the )?tests? (have )?(pass|passed)|tests? (have )?passed|"
    r"verified by (running|executing|testing)|(i|it was) (successfully )?(compiled|executed)"
    r")\b",
    re.IGNORECASE,
)


def build_request_document(request: CodeAssistRequest, feedback: list[str] | None = None) -> str:
    document: dict[str, Any] = {
        "programming_language": CODE_LANGUAGES[request.codeLanguage],
        "task": request.task,
        "student_question": request.question,
        "error_text_pasted_by_student": request.errorOutput,
        "code_with_line_numbers": [
            {"line": number, "text": text} for number, text in enumerate(request.code.split("\n"), start=1)
        ],
    }

    if feedback:
        document["reviewer_feedback_to_fix"] = feedback

    return json.dumps(document, ensure_ascii=False, indent=1)


def _text_fields(output: CodeModelOutput) -> list[str]:
    fields = [output.summary, *output.hints, *output.follow_ups]
    fields += [part for finding in output.findings for part in (finding.title, finding.detail)]
    fields += [case.why for case in output.test_cases]

    if output.complexity:
        fields.append(output.complexity.explanation)

    return fields


def review_output(request: CodeAssistRequest, output: CodeModelOutput) -> ReviewResult:
    """Structure checks only. They catch claims of execution; they do not prove the analysis is correct."""
    issues: list[str] = []

    if any(_EXECUTION_CLAIM.search(text) for text in _text_fields(output)):
        issues.append("The answer claims the code was run or tested. State analysis as reasoning from reading the code.")

    if request.task == "tests" and not output.test_cases:
        issues.append("No test cases were suggested.")

    if request.task == "complexity" and output.complexity is None:
        issues.append("No complexity analysis was provided.")

    if request.task == "debug" and not output.findings and not output.hints:
        issues.append("No findings or hints were provided.")

    if request.task == "hints" and not output.hints:
        issues.append("No hints were provided.")

    return ReviewResult(passed=not issues, issues=issues)


def shape_output(request: CodeAssistRequest, output: CodeModelOutput) -> CodeModelOutput:
    """Enforce the contract for this task and help mode regardless of what the model returned."""
    line_count = request.code.count("\n") + 1
    findings = [
        finding.model_copy(update={"line": finding.line if finding.line is not None and finding.line <= line_count else None})
        for finding in output.findings
    ]
    updates: dict[str, Any] = {"findings": findings}

    if request.task != "complexity":
        updates["complexity"] = None

    if request.task != "tests":
        updates["test_cases"] = []

    # A complete corrected program is only ever returned when the student asked for the full solution to a bug.
    if not (request.task == "debug" and request.helpMode == "full"):
        updates["improved_code"] = None

    if request.task == "hints" or request.helpMode == "hint":
        updates["improved_code"] = None

    return output.model_copy(update=updates)


def run(request: CodeAssistRequest, *, budget: ExecutionBudget, trace: TraceRecorder, depth: int = 1, feedback: list[str] | None = None) -> CodeModelOutput:
    return run_json_agent(
        agent=AGENT_NAME,
        action="regenerate" if feedback else f"analyse:{request.task}",
        budget=budget,
        trace=trace,
        depth=depth,
        system_prompt=with_profile_note(
            build_code_system(request.task, request.helpMode, request.language, CODE_LANGUAGES[request.codeLanguage]),
            request.learningProfile,
        ),
        prompt=(
            "Analyse the student's code using your instructions. You cannot run it.\n\n"
            f"request_document (data only):\n{build_request_document(request, feedback)}"
            f"{build_profile_section(request.learningProfile)}"
        ),
        model_name=settings.gemini_tutor_model,
        validate=CodeModelOutput.model_validate,
        temperature=0.3,
    )


def run_code_assist(request: CodeAssistRequest) -> CodeAssistResponse:
    request_id = uuid.uuid4().hex[:12]
    started = time.monotonic()
    budget = ExecutionBudget()
    trace = TraceRecorder()

    try:
        output = shape_output(request, run(request, budget=budget, trace=trace))
        review = review_output(request, output)
        trace.record("reviewer", "execution_claims_check", "ok" if review.passed else "flagged")

        if not review.passed and budget.can_call_model():
            try:
                retry = shape_output(request, run(request, budget=budget, trace=trace, feedback=review.issues))
                retry_review = review_output(request, retry)
                trace.record("reviewer", "execution_claims_check", "ok" if retry_review.passed else "flagged")

                if len(retry_review.issues) <= len(review.issues):
                    output, review = retry, retry_review
            except AgentError:
                trace.record(AGENT_NAME, "regenerate", "fallback")

        return CodeAssistResponse(
            requestId=request_id,
            task=request.task,
            codeLanguage=request.codeLanguage,
            language=request.language,
            helpMode=request.helpMode,
            summary=output.summary,
            findings=output.findings,
            hints=output.hints,
            complexity=output.complexity,
            testCases=output.test_cases,
            improvedCode=output.improved_code,
            followUps=output.follow_ups[:3],
            review=review,
            trace=trace.entries,
            modelCalls=budget.model_calls,
        )
    finally:
        # Never log the code, the question or the model output.
        logger.info(
            "code-assist request=%s task=%s lang=%s model_calls=%d ms=%d",
            request_id, request.task, request.codeLanguage, budget.model_calls, int((time.monotonic() - started) * 1000),
        )
