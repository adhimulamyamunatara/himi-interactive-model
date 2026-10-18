# HIMI Phase 3 — status, limits and manual checks

This page says exactly what Phase 3 delivers, what it does not, and what still has to be checked by a person.
It is written from what was actually built and tested, not from the original plan.

## Status

| Area | Status | What is real | What is not |
| --- | --- | --- | --- |
| Brand design system | Operational | Logo, colours, tokens and components used across the app | — |
| Tutor planning + multi-agent mentor | Operational | Router, subject tutor, reviewer, orchestrator with a call/depth/time budget and a safe trace | The reviewer checks structure, not facts |
| Live coding assistant | Operational | Explains, debugs, hints; analyses code and never runs it | No execution, so results are never "verified" |
| Diagram generation | Operational | Validated node/edge graph drawn by HIMI itself; SVG export; add to whiteboard | Diagrams can still be conceptually wrong |
| Voice (read-aloud, dictation) | Operational, browser-dependent | Opt-in. Uses the browser's speech services | Not hands-free conversation. Telugu voices depend on the device and are reported honestly when missing |
| Multi-language (English / Telugu) | Operational | UI and explanation language are separate; key and placeholder parity is tested | Only two languages. Telugu quality depends on the model |
| Camera photo helper | Partial | One still photo, user-started, sent only when the student presses the explain button. Server validates type and size, uses it once, never stores or logs it | **Not tested on real camera hardware.** Only Chrome's synthetic test camera was used. Choosing a file works without a camera |
| Real-time perception (emotion, attention, gestures) | **Not provided** | Honest capability list in the app. A self check-in with fixed tips is offered instead | No emotion, attention or gesture detection exists. On-device face counting is used only where the browser supports `FaceDetector`, and was tested only with a stand-in |
| Campus assistant | Operational (needs your documents) | Answers only from documents the student adds; every answer needs a quote that the server confirms appears in the document; otherwise a fixed "not found" message | HIMI ships no college data. It cannot tell if a document is out of date |
| Virtual classroom | Partial (solo only) | A local study room: agenda, notes, tutor Q&A, whiteboard and diagram links, summary and revision questions | **Not multi-user.** No other participants, no video or audio, nothing is shared between devices |

## What a real shared classroom needs (not built)

- A real-time server (WebSocket or a managed service such as LiveKit or Daily) for presence, chat and shared notes.
- Real accounts and permissions (today login is a local placeholder and data is per browser).
- A database for rooms, members and history.
- Media servers and TURN for audio/video, plus moderation, consent and recording rules.

## Configuration

Names only; values live in `backend/.env`, which is never committed.

- `GEMINI_API_KEY` — required for every AI feature. Without it the AI endpoints return a safe "not available" error.
- `GEMINI_TUTOR_MODEL` — model used by the tutor, code, diagram, camera, campus and classroom agents.
- Other existing keys: `GEMINI_MODEL`, `GEMINI_QUIZ_MODEL`, `GEMINI_PLANNER_MODEL`, `GEMINI_NOTES_MODEL`, `ALLOWED_ORIGINS`, `APP_ENV`, `APP_HOST`, `APP_PORT`.
- Frontend: the API base URL is read from the Vite environment (`VITE_API_BASE_URL`); see `frontend/src/services/apiClient.js`.

Provider limits: Gemini quotas, rate limits and latency apply to all AI features. Each request is capped at three model calls, depth two and about 100 seconds.

## Privacy

- Everything stored lives in this browser's `localStorage`: preferences, campus documents, the study room, notes, quizzes and plans. There is no database.
- **Camera:** it never starts by itself. It stops after the photo, when you leave the page, when the tab is hidden and when the camera setting is turned off. The photo is shrunk in memory, not saved, and sent to Google Gemini only when you press the explain button. The server response says `imageRetained: false`, and the client rejects any response that does not.
- **Voice:** dictation and read-aloud use the browser's own speech services, which may send audio or text to the browser vendor. Nothing is recorded by HIMI. Auto-read is off by default and never reads old messages.
- **Campus assistant:** only the passages of your documents that match the question are sent to Gemini. Do not paste private data.
- Logs record sizes, timings and statuses only, never prompts, photos or documents.

## How answers are guarded

- Campus answers: server checks that each citation is an exact passage from a supplied document, and that numbers, emails and links in the answer appear in the cited documents. One retry, then a fixed "not found" message. The browser checks the quotes again.
- Untrusted text (documents, photos, student input) is always passed as data, with instructions to ignore commands inside it.

## Verification that was run

- Backend unit tests (`cd backend && .venv/bin/python -m unittest discover -s tests`), frontend lint, unit tests and build (`cd frontend && npm run lint && npm test && npm run build`).
- Browser end-to-end scripts with Playwright against a local backend, using mocked responses for failure paths and live Gemini calls for the camera photo endpoint, code, diagrams, campus questions and classroom summaries.
- Not verified: a real camera, real microphones and speech voices on several devices, browsers other than Chrome, Safari/iOS, screen readers, and load.

## Manual verification checklist

1. Camera (needs a device with a working camera): allow access, take a photo, confirm the camera light turns off straight after, switch tabs while it is on and confirm it stops, deny permission and confirm the message is clear.
2. Voice: dictate a short question in English and in Telugu; read an answer aloud; check what happens when no Telugu voice is installed.
3. Campus: add a real circular, ask a question that is in it and one that is not; confirm the second says "not found".
4. Classroom: create a room, reload, end it; confirm nothing implies other people are present.
5. Switch the UI and explanation languages to Telugu and look for untranslated text or clipped layouts.
6. Check mobile width, keyboard-only use, and a screen reader on the Camera, Campus and Classroom pages.
7. Safari and Firefox: speech and camera support differ; note what each browser reports on the capability list.
