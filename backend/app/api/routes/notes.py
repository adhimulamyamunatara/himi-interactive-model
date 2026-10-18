import asyncio
import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from app.schemas.notes import (
    MAX_PDF_BYTES,
    NotesExtractResponse,
    NotesSummarizeRequest,
    NotesSummarizeResponse,
)
from app.services.notes_service import NotesServiceError, summarize_notes
from app.services.pdf_service import (
    EXTRACTION_SECONDS,
    PdfEmptyFileError,
    PdfError,
    PdfTimeoutError,
    PdfTooLargeError,
    PdfUnsupportedTypeError,
    extract_pdf_text,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notes", tags=["notes"])


def _pdf_http_error(error: PdfError) -> HTTPException:
    return HTTPException(status_code=error.status_code, detail=error.public_message)


async def _read_limited_body(request: Request) -> bytes:
    """Read the request body, refusing anything above the size limit without buffering it all."""
    declared = request.headers.get("content-length")

    if declared is not None and declared.isdigit() and int(declared) > MAX_PDF_BYTES:
        raise PdfTooLargeError()

    body = bytearray()

    async for chunk in request.stream():
        body.extend(chunk)

        if len(body) > MAX_PDF_BYTES:
            raise PdfTooLargeError()

    return bytes(body)


@router.post("/extract", response_model=NotesExtractResponse)
async def extract_notes_text(request: Request) -> NotesExtractResponse:
    """Read the text of an uploaded PDF. The PDF is the raw request body (``Content-Type: application/pdf``).

    This step never contacts the AI. The file is processed in memory and discarded when the response is sent.
    """
    try:
        content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()

        if content_type != "application/pdf":
            raise PdfUnsupportedTypeError()

        data = await _read_limited_body(request)

        if not data:
            raise PdfEmptyFileError()

        try:
            result = await asyncio.wait_for(
                run_in_threadpool(extract_pdf_text, data), timeout=EXTRACTION_SECONDS + 5
            )
        except asyncio.TimeoutError as exc:
            raise PdfTimeoutError() from exc
    except PdfError as error:
        raise _pdf_http_error(error) from error

    return NotesExtractResponse(
        text=result.text,
        page_count=result.page_count,
        word_count=result.word_count,
        character_count=len(result.text),
        truncated=result.truncated,
    )


@router.post("/summarize", response_model=NotesSummarizeResponse)
def summarize_notes_endpoint(payload: NotesSummarizeRequest) -> NotesSummarizeResponse:
    """Summarise notes text with the AI. Only called after the student explicitly asks for a summary.

    A plain ``def`` on purpose: the Gemini call blocks, so FastAPI runs it in a worker thread.
    """
    try:
        notes = summarize_notes(payload)
    except NotesServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.public_message) from exc

    return NotesSummarizeResponse(title=payload.title, notes=notes)
