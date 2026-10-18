"""Review agent: automated structure and consistency checks on a tutor answer (no model call).

This is deliberately modest. It catches problems that can be detected reliably (wrong language, a "hint only"
answer that leaks a full program, an answer unrelated to the question, a duplicated plan). It does NOT verify
that the content is factually correct, and the UI says so.
"""

from __future__ import annotations

import re

from app.schemas.tutor import ReviewResult, TutorModelOutput, TutorRequest

_CODE_BLOCK = re.compile(r"```.*?```", re.DOTALL)
_TELUGU = re.compile(r"[\u0C00-\u0C7F]")
_LETTER = re.compile(r"[^\W\d_]", re.UNICODE)
_WORD = re.compile(r"[a-z][a-z0-9+#]{3,}")
_STOP = frozenset(
    "what when where which that this with from have does explain about their there would could should "
    "please give show tell help into your much many some more most than then them they were been being".split()
)

MAX_HINT_CODE_LINES = 8
MIN_TELUGU_SHARE = 0.2


def _strip_code(text: str) -> str:
    return _CODE_BLOCK.sub(" ", text)


def _telugu_share(text: str) -> float:
    letters = _LETTER.findall(text)

    if not letters:
        return 0.0

    return len(_TELUGU.findall(text)) / len(letters)


def _longest_code_block_lines(text: str) -> int:
    return max((block.count("\n") - 1 for block in _CODE_BLOCK.findall(text)), default=0)


def _keywords(text: str) -> set[str]:
    return {word for word in _WORD.findall(text.lower()) if word not in _STOP}


def review_answer(request: TutorRequest, intent: str, output: TutorModelOutput) -> ReviewResult:
    issues: list[str] = []
    prose = _strip_code(output.answer)

    if len(prose.strip()) < 20 and "```" not in output.answer:
        issues.append("The answer is too short to be useful.")

    titles = [step.title.lower() for step in output.plan.steps]

    if len(set(titles)) != len(titles):
        issues.append("The plan repeats the same step title.")

    if request.language == "te" and _telugu_share(prose) < MIN_TELUGU_SHARE:
        issues.append("The explanation is not written in Telugu as requested.")

    if request.language == "en":
        # Relevance: a real answer normally shares at least one meaningful word with the question or topic.
        wanted = _keywords(request.message) | _keywords(request.topic or "")
        if len(wanted) >= 2 and not wanted & _keywords(output.answer):
            issues.append("The answer does not seem to address the question.")

    if (request.helpMode == "hint" or intent == "hint") and _longest_code_block_lines(output.answer) > MAX_HINT_CODE_LINES:
        issues.append("Hint mode was selected, but the answer contains a long, complete code listing.")

    return ReviewResult(passed=not issues, issues=issues)
