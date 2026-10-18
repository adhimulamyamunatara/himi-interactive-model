"""Safe text extraction from an uploaded PDF.

Privacy and safety rules implemented here:
- The PDF only ever exists in memory for the duration of the request. No temp file is written, so there is nothing to clean up.
- Nothing from the document is logged (only the kind of failure).
- Embedded content (JavaScript, attachments, links, forms) is never executed or followed: ``pypdf`` only parses it.
- The file is validated by its structure, not by its name or the declared type.
- Page count, extracted size and processing time are bounded.
"""

from __future__ import annotations

import io
import logging
import re
import time
from dataclasses import dataclass

from pypdf import PdfReader

from app.schemas.notes import MAX_NOTES_CHARS, MAX_PDF_BYTES, MAX_PDF_PAGES

logger = logging.getLogger(__name__)

EXTRACTION_SECONDS = 20.0  # cooperative deadline checked between pages
_HEADER_WINDOW = 1024  # the PDF spec allows a little leading data before "%PDF-"
_MAX_PAGE_CHARS_BEFORE_STOP = MAX_NOTES_CHARS + 5_000
_CONTROL_CHARACTERS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")


class PdfError(Exception):
    """Base class for problems the API layer turns into an HTTP response with a friendly message."""

    status_code = 422
    public_message = "This PDF could not be processed."


class PdfTooLargeError(PdfError):
    status_code = 413
    public_message = f"This file is too large. The limit is {MAX_PDF_BYTES // (1024 * 1024)} MB."


class PdfUnsupportedTypeError(PdfError):
    status_code = 415
    public_message = "Only PDF files are supported."


class PdfEmptyFileError(PdfError):
    public_message = "This file is empty."


class PdfInvalidError(PdfError):
    public_message = "This file is not a valid PDF."


class PdfCorruptedError(PdfError):
    public_message = "This PDF looks damaged and could not be read. Try exporting it again."


class PdfEncryptedError(PdfError):
    public_message = "This PDF is password-protected. Remove the password and upload it again."


class PdfTooManyPagesError(PdfError):
    public_message = f"This PDF has too many pages. The limit is {MAX_PDF_PAGES} pages."


class PdfNoTextError(PdfError):
    public_message = (
        "No selectable text was found in this PDF. It may be a scan or a set of images. "
        "HIMI cannot read scanned documents because OCR is not supported yet. Use a PDF with real text."
    )


class PdfTimeoutError(PdfError):
    status_code = 504
    public_message = "Reading this PDF took too long. Try a smaller file."


@dataclass(frozen=True, slots=True)
class ExtractedPdf:
    text: str
    page_count: int
    truncated: bool

    @property
    def word_count(self) -> int:
        return len(self.text.split())


def clean_extracted_text(text: str) -> str:
    """Remove control characters and collapse runs of whitespace while keeping paragraph breaks."""
    text = _CONTROL_CHARACTERS.sub(" ", text)
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r" ?\n ?", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_pdf_text(data: bytes, *, deadline_seconds: float = EXTRACTION_SECONDS) -> ExtractedPdf:
    """Return the text of a text-based PDF.

    Raises:
        PdfEmptyFileError, PdfTooLargeError, PdfInvalidError, PdfEncryptedError, PdfCorruptedError,
        PdfTooManyPagesError, PdfNoTextError, PdfTimeoutError
    """
    if not data:
        raise PdfEmptyFileError()

    if len(data) > MAX_PDF_BYTES:
        raise PdfTooLargeError()

    if b"%PDF-" not in data[:_HEADER_WINDOW]:
        raise PdfInvalidError()

    started = time.monotonic()

    try:
        reader = PdfReader(io.BytesIO(data), strict=False)

        if reader.is_encrypted:
            raise PdfEncryptedError()

        page_count = len(reader.pages)
    except PdfError:
        raise
    except Exception as exc:  # pypdf raises many different exception types for damaged files
        logger.warning("PDF could not be parsed (%s).", type(exc).__name__)
        raise PdfCorruptedError() from exc

    if page_count == 0:
        raise PdfCorruptedError()

    if page_count > MAX_PDF_PAGES:
        raise PdfTooManyPagesError()

    parts: list[str] = []
    total = 0

    for page in reader.pages:
        if time.monotonic() - started > deadline_seconds:
            raise PdfTimeoutError()

        try:
            page_text = page.extract_text() or ""
        except Exception as exc:
            logger.warning("A PDF page could not be read (%s).", type(exc).__name__)
            raise PdfCorruptedError() from exc

        cleaned = clean_extracted_text(page_text)

        if cleaned:
            parts.append(cleaned)
            total += len(cleaned)

        if total > _MAX_PAGE_CHARS_BEFORE_STOP:
            break  # more than enough; stop early instead of reading a huge document

    text = "\n\n".join(parts)

    if len(text.strip()) == 0:
        raise PdfNoTextError()

    truncated = len(text) > MAX_NOTES_CHARS
    if truncated:
        text = text[:MAX_NOTES_CHARS].rstrip()

    return ExtractedPdf(text=text, page_count=page_count, truncated=truncated)
