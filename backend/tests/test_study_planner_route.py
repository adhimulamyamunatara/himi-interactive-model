import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.api.routes import study_planner as route
from app.core.config import Settings
from app.main import app
from app.schemas.study_planner import StudyPlanGenerateResponse
from app.services.study_planner_service import (
    StudyPlanGenerationError,
    StudyPlannerTimeoutError,
    StudyPlannerUnavailableError,
    generate_study_plan,
)
from app.services import study_planner_service as service
from tests.study_planner_helpers import make_plan_json, make_request


class StudyPlannerRouteTests(unittest.TestCase):
    request = make_request()

    def test_route_is_registered_once_under_api_prefix_and_others_remain(self):
        paths = [route_.path for route_ in app.routes if getattr(route_, "path", "").startswith("/api/")]
        self.assertEqual(paths.count("/api/study-planner/generate"), 1)
        self.assertIn("/api/quiz/generate", paths)
        self.assertIn("/api/chat", paths)

    def test_success_response_shape(self):
        with patch.object(service, "generate_text", return_value=make_plan_json(self.request)):
            plan = generate_study_plan(self.request)

        with patch.object(route, "generate_study_plan", return_value=plan):
            response = route.generate_study_plan_endpoint(self.request)

        body = StudyPlanGenerateResponse.model_validate(response.model_dump()).model_dump(mode="json")
        self.assertEqual(body["status"], "success")
        self.assertEqual(
            set(body["plan"]),
            {
                "id", "title", "exam_date", "start_date", "plan_type", "subjects", "daily_available_minutes",
                "preferred_study_days", "total_planned_minutes", "total_tasks", "suggested_topic_subjects",
                "notes", "schedule",
            },
        )
        day = body["plan"]["schedule"][0]
        self.assertRegex(day["date"], r"^\d{4}-\d{2}-\d{2}$")
        self.assertEqual(set(day), {"date", "focus", "total_minutes", "tasks"})
        self.assertEqual(
            set(day["tasks"][0]),
            {"id", "subject", "title", "description", "duration_minutes", "activity_type", "completed"},
        )

    def test_service_errors_map_to_http_errors_with_friendly_messages(self):
        expected = {StudyPlannerUnavailableError: 503, StudyPlanGenerationError: 502, StudyPlannerTimeoutError: 504}
        for error_class, status_code in expected.items():
            with self.subTest(error_class.__name__):
                with patch.object(route, "generate_study_plan", side_effect=error_class()):
                    with self.assertRaises(HTTPException) as context:
                        route.generate_study_plan_endpoint(self.request)
                self.assertEqual(context.exception.status_code, status_code)
                self.assertTrue(context.exception.detail)
                self.assertNotIn("Traceback", context.exception.detail)


class PlannerModelSettingTests(unittest.TestCase):
    def test_planner_model_falls_back_to_chat_model(self):
        with patch.dict(os.environ, {"GEMINI_MODEL": "chat-model"}, clear=False):
            os.environ.pop("GEMINI_PLANNER_MODEL", None)
            self.assertEqual(Settings().gemini_planner_model, "chat-model")

    def test_planner_model_can_be_overridden_independently_of_the_quiz_model(self):
        with patch.dict(
            os.environ,
            {"GEMINI_MODEL": "chat-model", "GEMINI_PLANNER_MODEL": "planner-model", "GEMINI_QUIZ_MODEL": "quiz-model"},
        ):
            settings = Settings()
            self.assertEqual(settings.gemini_planner_model, "planner-model")
            self.assertEqual(settings.gemini_quiz_model, "quiz-model")


if __name__ == "__main__":
    unittest.main()
