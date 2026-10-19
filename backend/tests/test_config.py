import os
import unittest
from unittest.mock import patch

from app.core.config import Settings


class QuizModelSettingTests(unittest.TestCase):
    def test_quiz_model_falls_back_to_chat_model(self):
        with patch.dict(os.environ, {"GEMINI_MODEL": "chat-model"}, clear=False):
            os.environ.pop("GEMINI_QUIZ_MODEL", None)
            self.assertEqual(Settings().gemini_quiz_model, "chat-model")

    def test_quiz_model_can_be_overridden(self):
        with patch.dict(os.environ, {"GEMINI_MODEL": "chat-model", "GEMINI_QUIZ_MODEL": "fast-model"}):
            settings = Settings()
            self.assertEqual(settings.gemini_quiz_model, "fast-model")
            self.assertEqual(settings.gemini_model, "chat-model")


class AllowedOriginsTests(unittest.TestCase):
    def test_trailing_slashes_and_spaces_are_removed(self):
        from app.core.config import _split_origins

        self.assertEqual(
            _split_origins("https://a.github.io/, http://localhost:5173 ,,"),
            ["https://a.github.io", "http://localhost:5173"],
        )


class HealthRouteTests(unittest.TestCase):
    def test_healthz_is_registered_and_does_not_need_gemini(self):
        from app.main import app

        paths = {getattr(route, "path", None) for route in app.routes}
        self.assertIn("/healthz", paths)


if __name__ == "__main__":
    unittest.main()
