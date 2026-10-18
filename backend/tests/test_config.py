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


if __name__ == "__main__":
    unittest.main()
