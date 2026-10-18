"""The orchestrator hands code and drawing requests to their own tools, without spending a model call."""

import unittest
from unittest.mock import patch

from app.agents.orchestrator import run_tutor
from app.agents.router import classify_intent
from app.schemas.tutor import TutorRequest

GENERATE = "app.agents.base.generate_text"


def make_request(message, **overrides) -> TutorRequest:
    data = {"message": message, "subject": "Algorithms", "userName": "Asha"}
    data.update(overrides)
    return TutorRequest(**data)


class RoutingTests(unittest.TestCase):
    def test_code_requests_route_to_code_help(self):
        for message in (
            "Debug my code please",
            "find the bug in my loop",
            "why is my program crashing",
            "explain this code",
            "what is the time complexity of my code",
            "```python\nprint(1)\n```",
            "I get a NullPointerException",
        ):
            with self.subTest(message):
                self.assertEqual(classify_intent(make_request(message)).intent, "code_help")

    def test_drawing_requests_route_to_visual_with_a_topic(self):
        cases = {
            "draw a flowchart for bubble sort": "bubble sort",
            "Draw deadlock": "deadlock",
            "show me a diagram of the TCP handshake": "the TCP handshake",
            "create a diagram of paging": "paging",
        }
        for message, topic in cases.items():
            with self.subTest(message):
                decision = classify_intent(make_request(message))
                self.assertEqual(decision.intent, "visual")
                self.assertEqual(decision.topic, topic)

    def test_questions_about_diagrams_or_code_concepts_stay_explanations(self):
        for message in ("what is an ER diagram", "Explain how recursion works", "Explain binary search", "What is a pointer in C"):
            with self.subTest(message):
                self.assertNotIn(classify_intent(make_request(message)).intent, ("code_help", "visual"))

    def test_existing_quiz_and_planner_routing_wins_first(self):
        self.assertEqual(classify_intent(make_request("quiz me on my code")).intent, "quiz")
        self.assertEqual(classify_intent(make_request("make a study plan for algorithms")).intent, "planner")


class OrchestratorHandoffTests(unittest.TestCase):
    def test_code_help_is_a_handoff_with_zero_model_calls(self):
        with patch(GENERATE) as stub:
            response = run_tutor(make_request("debug my code"))
        stub.assert_not_called()
        self.assertEqual(response.outcome, "handoff")
        self.assertEqual(response.handoff.kind, "code")
        self.assertEqual(response.model_calls, 0)

    def test_visual_is_a_handoff_carrying_the_topic(self):
        with patch(GENERATE) as stub:
            response = run_tutor(make_request("draw a flowchart for bubble sort"))
        stub.assert_not_called()
        self.assertEqual((response.handoff.kind, response.handoff.topic, response.handoff.subject), ("diagram", "bubble sort", "Algorithms"))

    def test_the_students_code_is_not_copied_into_the_handoff(self):
        with patch(GENERATE):
            response = run_tutor(make_request("```python\nsecret_value = 1\n```"))
        self.assertNotIn("secret_value", response.model_dump_json())


if __name__ == "__main__":
    unittest.main()
