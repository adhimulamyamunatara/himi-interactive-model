import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.api.routes import quiz as quiz_route
from app.main import app
from app.schemas.quiz import QuizGenerateRequest, QuizGenerateResponse, QuizPayload
from app.services.quiz_service import (
    QuizGenerationError,
    QuizServiceUnavailableError,
    QuizTimeoutError,
    validate_questions,
)
from tests.helpers import make_quiz_data


def _payload() -> QuizPayload:
    return QuizPayload(
        subject="DBMS",
        topic=None,
        difficulty="Medium",
        questions=validate_questions(make_quiz_data(5), 5),
    )


class QuizRouteTests(unittest.TestCase):
    request = QuizGenerateRequest(subject="DBMS")

    def test_route_is_registered_once_under_api_prefix(self):
        paths = [route.path for route in app.routes if getattr(route, "path", "").startswith("/api/quiz")]
        self.assertEqual(paths, ["/api/quiz/generate"])
        self.assertIn("/api/chat", [route.path for route in app.routes])

    def test_success_response_shape(self):
        with patch.object(quiz_route, "generate_quiz", return_value=_payload()):
            response = quiz_route.generate_quiz_endpoint(self.request)
        body = QuizGenerateResponse.model_validate(response.model_dump()).model_dump()
        self.assertEqual(body["status"], "success")
        self.assertEqual(len(body["quiz"]["questions"]), 5)
        self.assertEqual(
            set(body["quiz"]["questions"][0]),
            {"id", "question", "options", "correct_answer", "explanation"},
        )

    def test_service_errors_map_to_http_errors_with_friendly_messages(self):
        expected = {QuizServiceUnavailableError: 503, QuizGenerationError: 502, QuizTimeoutError: 504}
        for error_class, status_code in expected.items():
            with self.subTest(error_class.__name__):
                with patch.object(quiz_route, "generate_quiz", side_effect=error_class()):
                    with self.assertRaises(HTTPException) as context:
                        quiz_route.generate_quiz_endpoint(self.request)
                self.assertEqual(context.exception.status_code, status_code)
                self.assertTrue(context.exception.detail)
                self.assertNotIn("Traceback", context.exception.detail)


if __name__ == "__main__":
    unittest.main()
