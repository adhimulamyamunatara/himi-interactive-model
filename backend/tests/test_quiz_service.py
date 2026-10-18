import random
import unittest
from unittest.mock import patch

from app.schemas.quiz import QuizGenerateRequest
from app.services import quiz_service
from app.services.gemini_service import GeminiConfigError, GeminiRequestError, GeminiTimeoutError
from app.services.quiz_service import (
    QuizGenerationError,
    QuizServiceUnavailableError,
    QuizTimeoutError,
    QuizValidationError,
    parse_quiz_json,
    shuffle_options,
    validate_questions,
)
from tests.helpers import make_question, make_quiz_data, make_quiz_json


class ParseQuizJsonTests(unittest.TestCase):
    def test_plain_json(self):
        self.assertEqual(len(parse_quiz_json(make_quiz_json(3))["questions"]), 3)

    def test_markdown_fenced_json(self):
        self.assertEqual(len(parse_quiz_json(f"```json\n{make_quiz_json(2)}\n```")["questions"]), 2)

    def test_json_surrounded_by_prose(self):
        self.assertEqual(len(parse_quiz_json(f"Here is your quiz:\n{make_quiz_json(2)}\nEnjoy!")["questions"]), 2)

    def test_invalid_json_raises(self):
        for text in ("", "not json at all", '{"questions": [', "```json\n{broken}\n```"):
            with self.subTest(text):
                with self.assertRaises(QuizValidationError):
                    parse_quiz_json(text)


class ValidateQuestionsTests(unittest.TestCase):
    def test_valid_quiz_passes(self):
        questions = validate_questions(make_quiz_data(5), 5)
        self.assertEqual([q.id for q in questions], ["q1", "q2", "q3", "q4", "q5"])
        self.assertEqual(questions[0].correct_answer, "Option 1-B")

    def test_bare_list_is_accepted(self):
        self.assertEqual(len(validate_questions(make_quiz_data(5)["questions"], 5)), 5)

    def test_wrong_question_count_is_rejected(self):
        for count in (4, 6):
            with self.subTest(count):
                with self.assertRaises(QuizValidationError):
                    validate_questions(make_quiz_data(count), 5)

    def test_invalid_structures_are_rejected(self):
        cases = {
            "not an object": [{"questions": "nope"}, None, 42, "text"],
            "correct answer not in options": [make_question(1, correct_answer="Something else")],
            "three options": [make_question(1, options=["a", "b", "c"], correct_answer="a")],
            "five options": [make_question(1, options=["a", "b", "c", "d", "e"], correct_answer="a")],
            "duplicate options": [make_question(1, options=["a", "A", "c", "d"], correct_answer="c")],
            "empty option": [make_question(1, options=["a", " ", "c", "d"], correct_answer="a")],
            "empty question": [make_question(1, question="  ")],
            "missing explanation": [make_question(1, explanation="")],
            "missing id": [make_question(1, id="")],
            "non-string question": [make_question(1, question=123)],
            "options not a list": [make_question(1, options="a,b,c,d")],
        }
        for name, payload in cases.items():
            with self.subTest(name):
                data = payload[0] if name == "not an object" else {"questions": payload}
                targets = payload if name == "not an object" else [data]
                for target in targets:
                    with self.assertRaises(QuizValidationError):
                        validate_questions(target, 1)

    def test_duplicate_ids_are_rejected(self):
        data = {"questions": [make_question(1), make_question(2, id="q1")]}
        with self.assertRaises(QuizValidationError):
            validate_questions(data, 2)

    def test_repeated_questions_are_rejected(self):
        data = {"questions": [make_question(1), make_question(2, question="  SAMPLE question number 1?  ")]}
        with self.assertRaises(QuizValidationError):
            validate_questions(data, 2)

    def test_whitespace_around_correct_answer_is_tolerated(self):
        data = {"questions": [make_question(1, correct_answer="  Option 1-B ")]}
        self.assertEqual(validate_questions(data, 1)[0].correct_answer, "Option 1-B")


class ShuffleOptionsTests(unittest.TestCase):
    def test_shuffle_keeps_options_and_answer_key_valid(self):
        questions = validate_questions(make_quiz_data(10), 10)
        shuffled = shuffle_options(questions, random.Random(7))
        for before, after in zip(questions, shuffled):
            self.assertCountEqual(before.options, after.options)
            self.assertIn(after.correct_answer, after.options)
            self.assertEqual(before.correct_answer, after.correct_answer)
        self.assertNotEqual([q.options for q in questions], [q.options for q in shuffled])


class GenerateQuizTests(unittest.TestCase):
    request = QuizGenerateRequest(subject="DBMS", topic="Normalization", num_questions=5, difficulty="Hard")

    def test_success_returns_validated_quiz_with_request_metadata(self):
        with patch.object(quiz_service, "generate_text", return_value=make_quiz_json(5)) as mocked:
            quiz = quiz_service.generate_quiz(self.request)
        self.assertEqual(mocked.call_count, 1)
        self.assertEqual((quiz.subject, quiz.topic, quiz.difficulty), ("DBMS", "Normalization", "Hard"))
        self.assertEqual(len(quiz.questions), 5)
        for question in quiz.questions:
            self.assertIn(question.correct_answer, question.options)

    def test_prompt_contains_request_parameters(self):
        prompt = quiz_service.build_quiz_prompt(self.request)
        for expected in ("DBMS", "Normalization", "Hard", "5"):
            self.assertIn(expected, prompt)
        blank_topic = quiz_service.build_quiz_prompt(QuizGenerateRequest(subject="Java"))
        self.assertIn("Core concepts", blank_topic)

    def test_invalid_output_is_retried_once_then_succeeds(self):
        with patch.object(quiz_service, "generate_text", side_effect=["garbage", make_quiz_json(5)]) as mocked:
            quiz = quiz_service.generate_quiz(self.request)
        self.assertEqual(mocked.call_count, 2)
        self.assertEqual(len(quiz.questions), 5)

    def test_persistently_invalid_output_fails_after_bounded_attempts(self):
        with patch.object(quiz_service, "generate_text", return_value=make_quiz_json(3)) as mocked:
            with self.assertRaises(QuizGenerationError):
                quiz_service.generate_quiz(self.request)
        self.assertEqual(mocked.call_count, quiz_service.MAX_GENERATION_ATTEMPTS)

    def test_missing_configuration_is_reported_as_unavailable(self):
        with patch.object(quiz_service, "generate_text", side_effect=GeminiConfigError("no key")):
            with self.assertRaises(QuizServiceUnavailableError):
                quiz_service.generate_quiz(self.request)

    def test_timeout_is_reported_without_retry(self):
        with patch.object(quiz_service, "generate_text", side_effect=GeminiTimeoutError("slow")) as mocked:
            with self.assertRaises(QuizTimeoutError):
                quiz_service.generate_quiz(self.request)
        self.assertEqual(mocked.call_count, 1)

    def test_upstream_failure_is_reported_without_retry_and_hides_details(self):
        with patch.object(quiz_service, "generate_text", side_effect=GeminiRequestError("secret internal detail")) as mocked:
            with self.assertRaises(QuizGenerationError) as context:
                quiz_service.generate_quiz(self.request)
        self.assertEqual(mocked.call_count, 1)
        self.assertNotIn("secret", context.exception.public_message)


if __name__ == "__main__":
    unittest.main()
