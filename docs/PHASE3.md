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
| HIMI robot companion | Operational | One shared robot with seven real-state poses, text and turn-based voice, the real tutor, and links to the real tools | Live mode is a hands-free turn-taking loop, not streaming audio or full-duplex. Basic mode cannot explain subjects. Voice tested with a fake speech API only. No emotion or attention detection |
| Multi-language (English / Telugu) | Operational | UI and explanation language are separate; key and placeholder parity is tested | Only two languages. Telugu quality depends on the model |
| Camera photo helper | Partial | One still photo, user-started, sent only when the student presses the explain button. Server validates type and size, uses it once, never stores or logs it | **Not tested on real camera hardware.** Only Chrome's synthetic test camera was used. Choosing a file works without a camera |
| Real-time perception (emotion, attention, gestures) | **Not provided** | Honest capability list in the app. A self check-in with fixed tips is offered instead | No emotion, attention or gesture detection exists. On-device face counting is used only where the browser supports `FaceDetector`, and was tested only with a stand-in |
| Campus assistant | Operational (needs your documents) | Answers only from documents the student adds; every answer needs a quote that the server confirms appears in the document; otherwise a fixed "not found" message | HIMI ships no college data. It cannot tell if a document is out of date |
| Virtual classroom | Partial (solo only) | A local study room: agenda, notes, tutor Q&A, whiteboard and diagram links, summary and revision questions | **Not multi-user.** No other participants, no video or audio, nothing is shared between devices |

## Light and dark themes

- Three choices: **Light**, **Dark** and **Match my device** (the default). The header button flips between light and dark; Profile → Appearance has all three. The choice is saved in this browser only.
- The theme is set on `<html data-theme>` by a small script in `index.html` before first paint, so there is no flash, and by `useTheme` afterwards. "Match my device" follows the device live.
- Implementation: the colour tokens in `src/styles/tokens.js` have a dark set that re-points the same CSS variables, so components did not need `dark:` classes. Solid fills such as buttons and gradients keep their colours in both themes, so white button text stays readable. `.force-light` keeps an area light inside the dark theme: the dark bands on the landing page, code blocks and diagram paper. The whiteboard canvas is white paper in both themes on purpose.
- The logo has navy letters, so in the dark theme it sits on a soft white plate.
- Checked automatically: every page was loaded in both themes at desktop width and scanned for text below a 3:1 contrast ratio and for horizontal overflow, and the token contrast ratios are unit tested. Not checked: a person's eye on every state (empty, error, loading) of every page, print styles, and forced-colors (high-contrast) mode.

## HIMI robot companion

HIMI is the student's main way into the app: a robot that listens, thinks, speaks and teaches, and that can take the student to the real tools.

- **Where it lives.** One companion for the whole app. On the Dashboard it is a large "Talk to HIMI" card. On other pages (not Home, Login, Chat or Mentor, which already are conversations) it is a floating button that opens a panel: a pop-up panel on desktop and a bottom sheet on phones. The Dashboard card and the floating panel are two views of the same conversation, never two robots.
- **Robot states.** Idle, listening, thinking, speaking, teaching, celebrating, error. The state is worked out from real facts: the microphone is on, a tutor request is in flight, a reply is being read aloud, a request failed, a reply has just arrived, or a quiz was passed (60% or more). Each state has its own pose and badge, so it is not shown by colour or motion alone, and a screen reader is told when the state changes. With reduced motion the loops stop and only the poses remain. "Speaking" is a looping mouth while audio plays, not lip-sync.
- **Text and voice.** Typing always works. The microphone only starts when the student presses Start in the voice panel; the words go into the box and nothing is sent until the student presses Send. Replies are read aloud only from a Listen button or when "Read replies aloud" is on (off by default). Stop speaking works at any time, and sending a message also stops the reading. This is turn-based. It is **not** hands-free or full-duplex.
- **One question at a time.** The send button is locked while a request is running, so a double Enter is one request. Stop cancels it and a late answer is dropped. Retry re-asks the same question. An answer that arrives after sign-out, sign-in as someone else, or "Start over" is discarded. The conversation is kept in memory only, and is cleared on sign-out.
- **It uses the existing tutor.** Questions go to the same multi-agent tutor as the Mentor page, with the chosen subject, explanation language (English or Telugu), and a short summary of the student's quiz history. Tool requests come back as a link to the real Quiz, Planner, Code or Diagram page with the subject and topic filled in. The student follows the link; HIMI never jumps pages on its own. If a request is unclear, the tutor's clarifying question is shown.
- **Live mode (full screen).** "Talk to HIMI live" (Dashboard card, the floating button's microphone, the dock header, and the Home page for signed-in students) opens HIMI full screen with a large robot. It is a hands-free *conversation loop*: HIMI greets you, listens, and when you stop talking sends what you said to the tutor, thinks, speaks the first few sentences of the answer (the whole answer stays on screen), then listens again by itself. The microphone only starts after you press the button, a visible "Microphone on" indicator and the robot's listening pose show when it is on, and Escape or the X ends everything. Tap HIMI to interrupt it while it speaks or thinks, or to start listening again after a pause. Mute, a "Voice replies" switch, a typing box and the English/Telugu switch are on screen.
- **If you cannot hear HIMI.** Chrome silently drops speech that starts right after a cancel, can garbage-collect a playing utterance (so it never reports that it finished), and a paused engine stays silent. The reader now waits a short moment after a cancel, keeps the playing utterance, resumes the engine, and if nothing starts within five seconds it stops saying "Speaking" and live mode shows a note to read the reply on screen and check the volume. This was verified with a fake engine only; a real speaker is a manual check.
- **What "live" is not.** It is not streaming audio and not full-duplex: it uses the browser's speech recognition and speech synthesis, and HIMI does not listen while it is speaking (its own voice would be heard as yours), so you interrupt by tapping. True low-latency voice (the Gemini Live API over a WebSocket with audio streaming) is not built; it would need a backend proxy for short-lived tokens and audio capture/playback code, and could only be verified on real hardware.
- **Stops by itself, never forever.** After three quiet turns HIMI pauses and waits for a tap. A refused or missing microphone, an unsupported browser, or voice turned off in Settings drops to a typing conversation with a clear message (and does not keep retrying). Leaving the tab pauses it. A reply that arrives after you interrupted, paused or left is never spoken.
- **Basic mode (when the AI cannot answer).** If the tutor request fails, or takes longer than 25 seconds, the live conversation does not go quiet: HIMI answers from a small fixed local responder (greetings, thanks, "what can you do", feeling stuck, a study tip, in English or Telugu) and says so ("Basic mode" badge and note). It will not explain subjects or guess; for those it says the AI is not reachable and offers pages that still work ("open the quiz"). Basic replies are labelled in the normal conversation too, and are never sent back to the AI as context. The badge clears as soon as a real answer arrives.
- **Quick commands.** A message that is only "open the whiteboard" (or go to, take me to, launch, start, switch to) opens that page directly. English only. Anything mixed with a question goes to the tutor.
- **Ask HIMI buttons.** Quiz results, notes, study plans, the code assistant and diagrams have an "Ask HIMI" button that puts a prompt built from that result into HIMI's box. It never sends by itself.
- **What is stored.** Only whether the panel was left open (and only applied on screens 768px or wider). No transcript, audio, API key or photo is stored by the companion.
- **Not claimed.** HIMI does not detect emotion, attention or gestures and does not pretend to have feelings. The camera is never started by HIMI.
- **Verified.** Unit tests for state derivation, command routing, the session controller (cancel, retry, stale answers, duplicates, ownership), prompts and the preference. A Playwright script of 125 checks (plus 100 more for live mode) against a local build, with the tutor, quiz and chat endpoints mocked and the browser's speech APIs replaced by a fake. That proves HIMI's handling of those APIs, **not** a real microphone or real voices. Also checked at 375, 768, 1024 and 1440px in light and dark themes for overflow, and with reduced motion.
- **Not verified.** A real microphone and speech voices (Chrome, Edge, Safari, Firefox, Android, iOS), a screen reader, live Gemini answers through the companion, and a person's eye on every robot pose, and the live loop with a real microphone (echo, noise, long pauses, accents, Telugu recognition quality).

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
8. HIMI live mode: open it, let HIMI greet you, speak a question, and check it answers and listens again; stay silent and confirm it pauses after three quiet turns; talk over it and confirm tapping interrupts; stop the backend (or remove the API key) and confirm basic mode answers and is labelled; refuse the microphone and confirm typing works; try Telugu with a Telugu voice installed.
9. HIMI companion: with a real microphone, press Start in the voice panel, dictate, Send, and use Listen and Stop speaking; refuse the microphone permission and confirm typing still works; look at all seven robot poses (the Home page "Meet HIMI" buttons preview them); check the bottom sheet on a real phone and with a screen reader.
