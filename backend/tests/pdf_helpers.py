"""Synthetic PDFs and a tiny ASGI caller for the notes tests. No real documents and no Gemini calls are involved."""

from __future__ import annotations

import asyncio
import io
import json

from pypdf import PdfWriter


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def make_text_pdf(pages: list[str], *, extra_catalog: str = "") -> bytes:
    """A small, valid, text-based PDF with one line of text per page (xref offsets are computed)."""
    objects: list[bytes] = []
    page_object_numbers = [3 + index * 2 for index in range(len(pages))]
    font_number = 3 + len(pages) * 2

    kids = " ".join(f"{number} 0 R" for number in page_object_numbers)
    objects.append(f"<< /Type /Catalog /Pages 2 0 R {extra_catalog} >>".encode())
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(pages)} >>".encode())

    for index, page_text in enumerate(pages):
        content_number = page_object_numbers[index] + 1
        stream = f"BT /F1 12 Tf 40 700 Td ({_escape(page_text)}) Tj ET".encode("latin-1", "replace")
        objects.append(
            (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {content_number} 0 R "
                f"/Resources << /Font << /F1 {font_number} 0 R >> >> >>"
            ).encode()
        )
        objects.append(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")

    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    output = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(output))
        output += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"

    xref_position = len(output)
    output += f"xref\n0 {len(objects) + 1}\n".encode()
    output += b"0000000000 65535 f \n"
    for offset in offsets:
        output += f"{offset:010d} 00000 n \n".encode()
    output += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_position}\n%%EOF\n".encode()
    return bytes(output)


def make_blank_pdf(page_count: int = 2) -> bytes:
    """A valid PDF with pages but no text, like a scan with no text layer."""
    writer = PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=612, height=792)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def make_encrypted_pdf(password: str = "secret") -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    writer.encrypt(password, algorithm="RC4-128")
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


async def call_app(app, method: str, path: str, body: bytes = b"", headers: dict[str, str] | None = None, chunk_size: int | None = None):
    """Send one request through the ASGI app in-process. Returns ``(status_code, json_or_text)``."""
    header_items = {key.lower(): value for key, value in (headers or {}).items()}
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "root_path": "",
        "headers": [(key.encode(), value.encode()) for key, value in header_items.items()],
        "client": ("testclient", 5000),
        "server": ("testserver", 80),
    }

    size = chunk_size or max(len(body), 1)
    chunks = [body[index : index + size] for index in range(0, len(body), size)] or [b""]

    async def receive():
        if chunks:
            chunk = chunks.pop(0)
            return {"type": "http.request", "body": chunk, "more_body": bool(chunks)}
        await asyncio.sleep(0.01)
        return {"type": "http.disconnect"}

    messages: list[dict] = []

    async def send(message):
        messages.append(message)

    await app(scope, receive, send)

    status = next(message["status"] for message in messages if message["type"] == "http.response.start")
    payload = b"".join(message.get("body", b"") for message in messages if message["type"] == "http.response.body")
    try:
        return status, json.loads(payload)
    except json.JSONDecodeError:
        return status, payload.decode(errors="replace")


def request(app, *args, **kwargs):
    return asyncio.run(call_app(app, *args, **kwargs))
