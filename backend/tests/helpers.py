"""Shared builders for the quiz tests (no real Gemini calls are made anywhere in these tests)."""

import json


def make_question(index: int, **overrides) -> dict:
    question = {
        "id": f"q{index}",
        "question": f"Sample question number {index}?",
        "options": [f"Option {index}-A", f"Option {index}-B", f"Option {index}-C", f"Option {index}-D"],
        "correct_answer": f"Option {index}-B",
        "explanation": f"Option {index}-B is correct because of reason {index}.",
    }
    question.update(overrides)
    return question


def make_quiz_data(count: int = 5) -> dict:
    return {"questions": [make_question(i) for i in range(1, count + 1)]}


def make_quiz_json(count: int = 5) -> str:
    return json.dumps(make_quiz_data(count))
