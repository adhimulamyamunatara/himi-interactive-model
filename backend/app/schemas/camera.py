"""Contracts for the camera photo helper.

The student sends ONE still image they chose to send (a photo of notes, a textbook page, a diagram or a problem).
The server validates it, passes it to the model for this request only, and never stores or logs it. The model's
output is untrusted and is validated and trimmed here before it reaches the browser.
"""

from __future__ import annotations

import base64
import binascii
import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.subjects import SUBJECTS
from app.schemas.learning_profile import LearningProfile
from app.schemas.tutor import SUPPORTED_LANGUAGES, HelpMode, ReviewResult, TraceEntry, clean_line, clean_multiline

IMAGE_MIME_TYPES = ("image/jpeg", "image/png", "image/webp")
MAX_IMAGE_BYTES = 3_500_000
# Base64 is 4/3 the size of the bytes; this bounds the string before it is ever decoded.
MAX_IMAGE_BASE64_CHARS = (MAX_IMAGE_BYTES * 4) // 3 + 8
MAX_QUESTION_CHARS = 500
MAX_KEY_POINTS = 6
MAX_FOLLOW_UPS = 3
MAX_EXTRACTED_CHARS = 4000
MAX_EXPLANATION_CHARS = 4000

CameraTask = Literal["explain", "transcribe", "question"]
ImageKind = Literal["notes", "textbook", "diagram", "code", "problem", "other", "not_study_material"]
Legibility = Literal["clear", "partly_unclear", "unreadable"]

_DATA_URL = re.compile(r"^data:(?P<mime>[\w/+.-]+);base64,", re.IGNORECASE)


def detect_image_type(data: bytes) -> str | None:
    """Identify the real image type from its first bytes (the declared type is never trusted)."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


class CameraAnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Base64 of the image bytes. A `data:...;base64,` prefix is tolerated and removed.
    image: str = Field(min_length=16, max_length=MAX_IMAGE_BASE64_CHARS + 64)
    mimeType: str
    task: CameraTask = "explain"
    question: str | None = Field(default=None, max_length=MAX_QUESTION_CHARS)
    subject: str | None = Field(default=None, max_length=60)
    language: str = "en"
    helpMode: HelpMode = "guided"
    learningProfile: LearningProfile | None = None

    @field_validator("mimeType")
    @classmethod
    def _mime_supported(cls, value: str) -> str:
        if value not in IMAGE_MIME_TYPES:
            raise ValueError("Unsupported image type. Use JPEG, PNG or WebP.")
        return value

    @field_validator("image")
    @classmethod
    def _image_clean(cls, value: str) -> str:
        text = value.strip()
        match = _DATA_URL.match(text)
        if match:
            text = text[match.end():]
        if len(text) > MAX_IMAGE_BASE64_CHARS:
            raise ValueError("The image is too large. Use a smaller photo.")
        return text

    @field_validator("question")
    @classmethod
    def _question_clean(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = clean_multiline(value)
        return cleaned or None

    @field_validator("subject")
    @classmethod
    def _subject_supported(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if value not in SUBJECTS:
            raise ValueError("Unsupported subject.")
        return value

    @field_validator("language")
    @classmethod
    def _language_supported(cls, value: str) -> str:
        if value not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported language. Supported: {', '.join(SUPPORTED_LANGUAGES)}.")
        return value

    def image_bytes(self) -> bytes:
        """Decode and verify the image. Raises ValueError (a 422-style problem) when it is not a real, allowed image."""
        try:
            data = base64.b64decode(self.image, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("The image data is not valid.") from exc

        if len(data) > MAX_IMAGE_BYTES:
            raise ValueError("The image is too large. Use a smaller photo.")

        actual = detect_image_type(data)
        if actual is None or actual != self.mimeType:
            raise ValueError("The file is not a valid JPEG, PNG or WebP image.")

        return data


class CameraModelOutput(BaseModel):
    """What the model must return. Tolerant: optional parts that are malformed are dropped."""

    model_config = ConfigDict(extra="ignore")

    title: str = Field(default="Your photo", max_length=120)
    kind: ImageKind = "other"
    legibility: Legibility = "clear"
    whatIsShown: str = Field(default="", max_length=600)
    extractedText: str | None = None
    explanation: str = Field(default="", max_length=MAX_EXPLANATION_CHARS)
    keyPoints: list[str] = Field(default_factory=list)
    followUps: list[str] = Field(default_factory=list)

    @field_validator("title", "whatIsShown", mode="before")
    @classmethod
    def _line(cls, value: Any) -> str:
        return clean_line(value) if isinstance(value, str) else ""

    @field_validator("extractedText", mode="before")
    @classmethod
    def _extracted(cls, value: Any) -> str | None:
        if not isinstance(value, str):
            return None
        cleaned = clean_multiline(value)[:MAX_EXTRACTED_CHARS]
        return cleaned or None

    @field_validator("explanation", mode="before")
    @classmethod
    def _explanation(cls, value: Any) -> str:
        return clean_multiline(value)[:MAX_EXPLANATION_CHARS] if isinstance(value, str) else ""

    @field_validator("keyPoints", "followUps", mode="before")
    @classmethod
    def _lines(cls, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [clean_line(item) for item in value if isinstance(item, str) and clean_line(item)]

    @field_validator("kind", "legibility", mode="before")
    @classmethod
    def _enum_default(cls, value: Any, info: Any) -> Any:
        allowed = {
            "kind": ("notes", "textbook", "diagram", "code", "problem", "other", "not_study_material"),
            "legibility": ("clear", "partly_unclear", "unreadable"),
        }[info.field_name]
        return value if value in allowed else ("other" if info.field_name == "kind" else "partly_unclear")


class CameraAnalyzeResponse(BaseModel):
    requestId: str
    task: CameraTask
    language: str
    title: str
    kind: ImageKind
    legibility: Legibility
    whatIsShown: str
    extractedText: str | None
    explanation: str
    keyPoints: list[str]
    followUps: list[str]
    # The server keeps nothing: the photo existed only for this request.
    imageRetained: Literal[False] = False
    review: ReviewResult
    trace: list[TraceEntry]
    modelCalls: int
