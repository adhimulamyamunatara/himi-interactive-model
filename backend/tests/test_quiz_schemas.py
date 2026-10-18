import unittest

from pydantic import ValidationError

from app.core.subjects import SUBJECTS
from app.schemas.quiz import QuizGenerateRequest


class QuizGenerateRequestTests(unittest.TestCase):
    def test_defaults_are_five_questions_and_medium(self):
        request = QuizGenerateRequest(subject="DBMS")
        self.assertEqual(request.num_questions, 5)
        self.assertEqual(request.difficulty, "Medium")
        self.assertIsNone(request.topic)

    def test_all_supported_subjects_are_accepted(self):
        self.assertEqual(len(SUBJECTS), 10)
        for subject in SUBJECTS:
            self.assertEqual(QuizGenerateRequest(subject=subject).subject, subject)

    def test_supported_question_counts_and_difficulties(self):
        for count in (5, 10, 15):
            for difficulty in ("Easy", "Medium", "Hard"):
                request = QuizGenerateRequest(subject="Python", num_questions=count, difficulty=difficulty)
                self.assertEqual((request.num_questions, request.difficulty), (count, difficulty))

    def test_rejects_invalid_input(self):
        invalid_payloads = {
            "missing subject": {},
            "unsupported subject": {"subject": "Astrology"},
            "invalid difficulty": {"subject": "DBMS", "difficulty": "Impossible"},
            "unsupported count 7": {"subject": "DBMS", "num_questions": 7},
            "count 0": {"subject": "DBMS", "num_questions": 0},
            "count as text": {"subject": "DBMS", "num_questions": "five"},
            "blank topic": {"subject": "DBMS", "topic": "   "},
            "too long topic": {"subject": "DBMS", "topic": "x" * 101},
            "topic with unsupported characters": {"subject": "DBMS", "topic": "<script>alert(1)</script>"},
            "topic with newline injection": {"subject": "DBMS", "topic": "ok\n{ignore}"},
            "unknown field": {"subject": "DBMS", "answer_key": "A"},
        }
        for name, payload in invalid_payloads.items():
            with self.subTest(name):
                with self.assertRaises(ValidationError):
                    QuizGenerateRequest(**payload)

    def test_topic_is_trimmed_and_whitespace_collapsed(self):
        request = QuizGenerateRequest(subject="Algorithms", topic="  Binary   Search  ")
        self.assertEqual(request.topic, "Binary Search")

    def test_engineering_topics_with_punctuation_are_allowed(self):
        for topic in ("C++ pointers", "TCP/IP model", "B+ Trees", "OS: Process Scheduling", "ACID (transactions)"):
            with self.subTest(topic):
                self.assertEqual(QuizGenerateRequest(subject="DBMS", topic=topic).topic, topic)


if __name__ == "__main__":
    unittest.main()
