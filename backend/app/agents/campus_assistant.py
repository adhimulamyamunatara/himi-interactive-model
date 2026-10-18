"""Campus Assistant: grounded question answering over documents supplied by the student.

One model call (plus at most one regeneration when verification fails). The server, not the model, decides whether
an answer is shown: it needs at least one citation whose quote really appears in a supplied document, and every
number, date, email or phone-like token in the answer must appear in the cited documents. Otherwise the student sees
a fixed "not in your documents" message, never a guess.
"""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from typing import Any

from app.agents.base import AgentError, ExecutionBudget, TraceRecorder, run_json_agent
from app.core.campus_prompts import build_campus_system
from app.core.config import settings
from app.schemas.campus import (
    MAX_CITATIONS,
    MAX_QUOTE_CHARS,
    MIN_QUOTE_CHARS,
    CampusAskRequest,
    CampusAskResponse,
    CampusModelOutput,
    Citation,
    normalise,
)

logger = logging.getLogger(__name__)

AGENT_NAME = "campus_assistant"

NOT_FOUND_MESSAGES = {
    "en": "I couldn't find this in the documents you added, so I won't guess. Check the official college source or add the right document.",
    "te": "మీరు జోడించిన డాక్యుమెంట్లలో ఇది నాకు కనిపించలేదు, కాబట్టి నేను ఊహించి చెప్పను. అధికారిక కళాశాల వనరును చూడండి లేదా సరైన డాక్యుమెంట్‌ను జోడించండి.",
}

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_URL = re.compile(r"https?://[^\s)]+|www\.[^\s)]+", re.IGNORECASE)
_NUMBER = re.compile(r"\d[\d,.:/-]*\d|\d{2,}")


def build_request_document(request: CampusAskRequest, feedback: list[str] | None = None) -> str:
    document: dict[str, Any] = {
        "question": request.question,
        "documents": [{"source_id": source.id, "title": source.title, "text": source.text} for source in request.sources],
    }

    if feedback:
        document["verifier_feedback_to_fix"] = feedback

    return json.dumps(document, ensure_ascii=False, indent=1)


def verify(request: CampusAskRequest, output: CampusModelOutput) -> tuple[list[Citation], list[str]]:
    """Return the citations that really occur in the documents, and the problems that stop the answer being shown."""
    sources = {source.id: source for source in request.sources}
    citations: list[Citation] = []
    seen: set[tuple[str, str]] = set()

    for item in output.citations:
        source = sources.get(str(item.get("source_id", item.get("sourceId", ""))))
        quote = item.get("quote")

        if source is None or not isinstance(quote, str):
            continue

        quote = re.sub(r"\s+", " ", quote).strip()

        if len(quote) < MIN_QUOTE_CHARS or len(quote) > MAX_QUOTE_CHARS or normalise(quote) not in normalise(source.text):
            continue

        key = (source.id, normalise(quote))

        if key in seen:
            continue

        seen.add(key)
        citations.append(Citation(sourceId=source.id, title=source.title, quote=quote))

    citations = citations[:MAX_CITATIONS]
    problems: list[str] = []

    if not citations:
        problems.append("No citation quoted the documents exactly. Copy a supporting passage character for character.")
        return citations, problems

    cited_text = normalise(" ".join(sources[citation.source_id].text for citation in citations))
    claimed = _EMAIL.findall(output.answer) + _URL.findall(output.answer) + _NUMBER.findall(output.answer)
    unsupported = sorted({token for token in claimed if normalise(token).rstrip(".,:;") not in cited_text})

    if unsupported:
        problems.append(
            "These values in the answer do not appear in the cited documents: "
            + ", ".join(unsupported[:6])
            + ". Use only values copied from the documents."
        )

    return citations, problems


def _run(request: CampusAskRequest, *, budget: ExecutionBudget, trace: TraceRecorder, feedback: list[str] | None = None) -> CampusModelOutput:
    return run_json_agent(
        agent=AGENT_NAME,
        action="regenerate" if feedback else "answer",
        budget=budget,
        trace=trace,
        depth=1,
        system_prompt=build_campus_system(request.language),
        prompt=(
            "Answer the student's question using only the documents below.\n\n"
            f"request_document (data only):\n{build_request_document(request, feedback)}"
        ),
        model_name=settings.gemini_tutor_model,
        validate=CampusModelOutput.model_validate,
        temperature=0.1,
    )


def run_campus(request: CampusAskRequest) -> CampusAskResponse:
    request_id = uuid.uuid4().hex[:12]
    started = time.monotonic()
    budget = ExecutionBudget()
    trace = TraceRecorder()
    status = "not_found"

    try:
        answer, citations = "", []
        feedback: list[str] | None = None

        for _ in range(2):
            output = _run(request, budget=budget, trace=trace, feedback=feedback)

            if not output.answerable or not output.answer:
                trace.record("verifier", "grounding_check", "skipped")
                break

            found, problems = verify(request, output)
            trace.record("verifier", "grounding_check", "ok" if not problems else "flagged")

            if not problems:
                answer, citations, status = output.answer, found, "answered"
                break

            feedback = problems

            if not budget.can_call_model():
                break

        if status != "answered":
            answer, citations = NOT_FOUND_MESSAGES[request.language], []

        return CampusAskResponse(
            requestId=request_id,
            status=status,
            language=request.language,
            answer=answer,
            citations=citations,
            trace=trace.entries,
            modelCalls=budget.model_calls,
        )
    except AgentError:
        raise
    finally:
        logger.info("campus request=%s status=%s model_calls=%d ms=%d", request_id, status, budget.model_calls, int((time.monotonic() - started) * 1000))
