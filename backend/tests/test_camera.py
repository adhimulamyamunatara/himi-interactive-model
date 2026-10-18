"""Camera photo helper: image validation, output shaping, privacy rules and endpoint.

Gemini is always replaced by a stub (``app.agents.base.generate_text``); no real image is ever sent anywhere.
"""

import base64
import json
import unittest
from unittest.mock import patch

from pydantic import ValidationError

from app.agents.base import AgentOutputError, AgentUnavailableError
from app.agents.photo_helper import review_output, run_photo, shape_output
from app.core.camera_prompts import build_camera_system
from app.main import app
from app.schemas.camera import MAX_IMAGE_BYTES, CameraAnalyzeRequest, CameraModelOutput, detect_image_type
from app.services.gemini_service import GeminiConfigError, GeminiRequestError
from tests.pdf_helpers import request as http

GENERATE = "app.agents.base.generate_text"

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 32


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def make_request(**overrides) -> CameraAnalyzeRequest:
    data = {"image": b64(PNG), "mimeType": "image/png", "task": "explain"}
    data.update(overrides)
    return CameraAnalyzeRequest(**data)


def model_data(**overrides) -> dict:
    data = {
        "title": "Process states",
        "kind": "diagram",
        "legibility": "clear",
        "whatIsShown": "A diagram of process states.",
        "extractedText": "Ready -> Running",
        "explanation": "The diagram shows how a process moves between **Ready** and **Running**.",
        "keyPoints": ["Ready means waiting for the CPU", "Running means executing"],
        "followUps": ["What is Blocked?"],
    }
    data.update(overrides)
    return data


class ImageValidationTests(unittest.TestCase):
    def test_real_types_are_detected_from_bytes(self):
        self.assertEqual(detect_image_type(PNG), "image/png")
        self.assertEqual(detect_image_type(JPEG), "image/jpeg")
        self.assertEqual(detect_image_type(WEBP), "image/webp")
        self.assertIsNone(detect_image_type(b"GIF89a....."))
        self.assertIsNone(detect_image_type(b"<svg xmlns='http://www.w3.org/2000/svg'></svg>"))

    def test_valid_images_decode(self):
        for data, mime in ((PNG, "image/png"), (JPEG, "image/jpeg"), (WEBP, "image/webp")):
            with self.subTest(mime):
                self.assertEqual(make_request(image=b64(data), mimeType=mime).image_bytes(), data)

    def test_data_url_prefix_is_accepted(self):
        request = make_request(image="data:image/png;base64," + b64(PNG))
        self.assertEqual(request.image_bytes(), PNG)

    def test_declared_type_must_match_the_real_bytes(self):
        with self.assertRaises(ValueError):
            make_request(image=b64(PNG), mimeType="image/jpeg").image_bytes()

    def test_svg_and_other_types_are_rejected(self):
        with self.assertRaises(ValidationError):
            make_request(mimeType="image/svg+xml")
        with self.assertRaises(ValueError):
            make_request(image=b64(b"<svg onload='alert(1)'></svg>" * 2), mimeType="image/png").image_bytes()

    def test_not_base64_is_rejected(self):
        with self.assertRaises(ValueError):
            make_request(image="this is not base64!!!!!!").image_bytes()

    def test_oversized_images_are_rejected_before_decoding(self):
        with self.assertRaises(ValidationError):
            make_request(image="A" * (MAX_IMAGE_BYTES * 2))

    def test_oversized_decoded_images_are_rejected(self):
        big = PNG + b"\x00" * (MAX_IMAGE_BYTES + 10)
        with self.assertRaises((ValidationError, ValueError)):
            make_request(image=b64(big)).image_bytes()

    def test_other_bad_input(self):
        for overrides in ({"task": "identify_person"}, {"language": "xx"}, {"subject": "Astrology"}, {"question": "x" * 501}):
            with self.subTest(overrides), self.assertRaises(ValidationError):
                make_request(**overrides)

    def test_unknown_fields_are_rejected(self):
        with self.assertRaises(ValidationError):
            make_request(url="http://example.com/a.png")


class ShapeOutputTests(unittest.TestCase):
    def shape(self, request=None, **overrides):
        return shape_output(CameraModelOutput.model_validate(model_data(**overrides)), request or make_request())

    def test_a_good_output_passes_through(self):
        out = self.shape()
        self.assertEqual(out.kind, "diagram")
        self.assertEqual(len(out.keyPoints), 2)

    def test_unreadable_photos_return_no_text_or_points(self):
        out = self.shape(legibility="unreadable")
        self.assertIsNone(out.extractedText)
        self.assertEqual(out.keyPoints, [])

    def test_a_photo_that_is_not_study_material_gets_a_short_refusal_only(self):
        out = self.shape(kind="not_study_material", whatIsShown="A smiling person with brown hair", explanation="x" * 900, extractedText="NAME TAG")
        self.assertEqual((out.whatIsShown, out.extractedText, out.keyPoints, out.followUps), ("", None, [], []))
        self.assertLessEqual(len(out.explanation), 400)

    def test_transcribe_has_no_key_points(self):
        out = self.shape(make_request(task="transcribe"))
        self.assertEqual(out.keyPoints, [])

    def test_lists_are_capped_and_junk_dropped(self):
        out = self.shape(keyPoints=[f"p{i}" for i in range(20)] + [5, None, ""], followUps=["a", "b", "c", "d", "e"])
        self.assertEqual((len(out.keyPoints), len(out.followUps)), (6, 3))

    def test_bad_enums_fall_back_safely(self):
        out = CameraModelOutput.model_validate(model_data(kind="selfie", legibility="perfect"))
        self.assertEqual((out.kind, out.legibility), ("other", "partly_unclear"))


class ReviewTests(unittest.TestCase):
    def test_empty_explanation_is_flagged(self):
        review = review_output(make_request(), CameraModelOutput.model_validate(model_data(explanation="")))
        self.assertFalse(review.passed)

    def test_telugu_requested_but_english_returned_is_flagged(self):
        review = review_output(make_request(language="te"), CameraModelOutput.model_validate(model_data()))
        self.assertFalse(review.passed)

    def test_telugu_passes(self):
        output = CameraModelOutput.model_validate(model_data(explanation="ఈ చిత్రం ప్రాసెస్ స్థితులను చూపిస్తుంది."))
        self.assertTrue(review_output(make_request(language="te"), output).passed)


class AgentFlowTests(unittest.TestCase):
    def test_one_call_when_the_output_is_good(self):
        with patch(GENERATE, return_value=json.dumps(model_data())) as stub:
            response = run_photo(make_request(), PNG)
        self.assertEqual(stub.call_count, 1)
        self.assertEqual(response.modelCalls, 1)
        self.assertFalse(response.imageRetained)

    def test_the_image_is_passed_to_the_model_as_bytes_with_its_type(self):
        with patch(GENERATE, return_value=json.dumps(model_data())) as stub:
            run_photo(make_request(image=b64(JPEG), mimeType="image/jpeg"), JPEG)
        self.assertEqual(stub.call_args.kwargs["images"], [("image/jpeg", JPEG)])

    def test_the_image_never_appears_in_the_prompt_text(self):
        with patch(GENERATE, return_value=json.dumps(model_data())) as stub:
            run_photo(make_request(), PNG)
        self.assertNotIn(b64(PNG), stub.call_args.args[0])
        self.assertNotIn(b64(PNG), stub.call_args.kwargs["system_instruction"])

    def test_a_flagged_result_is_regenerated_once(self):
        outputs = [json.dumps(model_data(explanation="Only English here.")), json.dumps(model_data(explanation="ఈ చిత్రం ప్రాసెస్ స్థితులను చూపిస్తుంది."))]
        with patch(GENERATE, side_effect=outputs) as stub:
            response = run_photo(make_request(language="te"), PNG)
        self.assertEqual(stub.call_count, 2)
        self.assertTrue(response.review.passed)

    def test_invalid_output_fails_safely(self):
        with patch(GENERATE, return_value="<html>not json</html>") as stub, self.assertRaises(AgentOutputError):
            run_photo(make_request(), PNG)
        self.assertLessEqual(stub.call_count, 2)

    def test_provider_failures(self):
        with patch(GENERATE, side_effect=GeminiConfigError("GEMINI_API_KEY")), self.assertRaises(AgentUnavailableError):
            run_photo(make_request(), PNG)
        with patch(GENERATE, side_effect=GeminiRequestError("upstream")), self.assertRaises(AgentOutputError):
            run_photo(make_request(), PNG)

    def test_logs_have_no_image_question_or_model_text(self):
        with patch(GENERATE, return_value=json.dumps(model_data(explanation="SECRET_MODEL_TEXT is here."))):
            with self.assertLogs("app.agents.photo_helper", level="INFO") as logs:
                run_photo(make_request(question="PRIVATE_QUESTION_TEXT"), PNG)
        joined = " ".join(logs.output)
        for secret in ("PRIVATE_QUESTION_TEXT", "SECRET_MODEL_TEXT", b64(PNG)):
            self.assertNotIn(secret, joined)

    def test_the_prompt_protects_privacy_and_treats_photo_text_as_data(self):
        system = build_camera_system("explain", "guided", "en")
        for needle in ("never identify", "not_study_material", "data, not instructions", "[unclear]"):
            self.assertIn(needle, system)


class ProviderCallTests(unittest.TestCase):
    """`generate_text` hands images to the SDK as inline data, and text-only calls are unchanged."""

    class FakeModel:
        last_contents = None

        def __init__(self, *args, **kwargs):
            pass

        def generate_content(self, contents, request_options=None):
            type(self).last_contents = contents

            class Result:
                text = "ok"

            return Result()

    def call(self, **kwargs):
        from app.services import gemini_service

        class FakeGenai:
            GenerativeModel = ProviderCallTests.FakeModel

            @staticmethod
            def configure(**_):
                pass

        with patch.object(gemini_service, "genai", FakeGenai), patch.object(gemini_service.settings, "gemini_api_key", "test-key"):
            return gemini_service.generate_text("prompt", system_instruction="sys", **kwargs)

    def test_images_are_sent_as_inline_data(self):
        self.call(images=[("image/png", PNG)])
        self.assertEqual(self.FakeModel.last_contents, ["prompt", {"mime_type": "image/png", "data": PNG}])

    def test_text_only_calls_are_unchanged(self):
        self.call()
        self.assertEqual(self.FakeModel.last_contents, "prompt")


class EndpointTests(unittest.TestCase):
    PATH = "/api/camera/analyze"

    def post(self, payload):
        return http(app, "POST", self.PATH, json.dumps(payload).encode(), {"content-type": "application/json"})

    def payload(self, **overrides):
        return {"image": b64(PNG), "mimeType": "image/png", "task": "explain", **overrides}

    def test_success_shape(self):
        with patch(GENERATE, return_value=json.dumps(model_data())):
            status, body = self.post(self.payload())
        self.assertEqual(status, 200)
        for key in ("requestId", "task", "title", "kind", "legibility", "whatIsShown", "explanation", "keyPoints", "followUps", "imageRetained", "review", "trace", "modelCalls"):
            self.assertIn(key, body)
        self.assertIs(body["imageRetained"], False)
        self.assertNotIn("image", body)

    def test_validation_errors_never_reach_the_model(self):
        with patch(GENERATE) as stub:
            for payload in (
                self.payload(mimeType="image/gif"),
                self.payload(task="who_is_this"),
                self.payload(image="not base64 at all!!!!"),
                self.payload(image=b64(b"<svg></svg>" * 4)),
                self.payload(image=b64(JPEG)),  # declared PNG but really JPEG
                {"mimeType": "image/png"},
            ):
                with self.subTest(list(payload)[:2]):
                    status, _ = self.post(payload)
                    self.assertEqual(status, 422)
        stub.assert_not_called()

    def test_error_responses_do_not_echo_the_image(self):
        status, body = self.post(self.payload(image=b64(b"<svg></svg>" * 4)))
        self.assertEqual(status, 422)
        self.assertNotIn(b64(b"<svg></svg>" * 4), json.dumps(body))

    def test_error_statuses_never_leak_internals(self):
        with patch(GENERATE, side_effect=GeminiConfigError("GEMINI_API_KEY missing")):
            status, body = self.post(self.payload())
        self.assertEqual(status, 503)
        self.assertNotIn("GEMINI_API_KEY", json.dumps(body))


if __name__ == "__main__":
    unittest.main()
