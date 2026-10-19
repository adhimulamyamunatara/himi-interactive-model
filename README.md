# HIMI – Human Inspired Multimodal Interaction Model

**A human-centred AI learning companion for engineering students.**

> Beyond chatbots: an AI companion that listens, understands, remembers and teaches like a mentor.

HIMI is a web app with a robot companion at its centre. Students talk to it by typing or by voice, it answers with Gemini, and it takes them to real learning tools: quizzes, a study planner, notes summaries, a code assistant, diagrams, a whiteboard and more.

This README describes what is **actually built** today. The original vision and the parts that are not built yet are listed honestly further down. Details of the advanced features and the manual checks still needed are in [`docs/PHASE3.md`](docs/PHASE3.md).

---

## Project vision

Today's AI assistants are mostly reactive: they wait for a question, answer it and forget. Human teachers observe, remember, adapt and guide. HIMI aims to bring that mentor-like experience to every engineering student: a personal companion that is available any time, remembers what the student studied, and adapts its explanations.

HIMI is not meant to replace teachers. It gives every student a patient study partner.

**Target users:** B.Tech, polytechnic and diploma students first; faculty, colleges and training centres next.

---

## What is built

### The HIMI companion

- **Robot companion.** One shared robot with seven poses (idle, listening, thinking, speaking, teaching, celebrating, error). Each pose reflects something real: the microphone is on, a request is running, a reply is being read aloud, and so on.
- **Dashboard stage, dock and floating button.** HIMI is a large card on the Dashboard and a floating panel on other pages, all sharing one conversation.
- **Live mode (full screen).** "Talk to HIMI live" opens HIMI full screen. It greets the student, listens, answers, speaks the start of the answer and listens again. The microphone only starts after the student presses the button. Tapping HIMI interrupts it. See *Honest limits* for what "live" means here.
- **Basic mode.** If the AI cannot be reached or takes too long, HIMI answers from a small local responder (greetings, thanks, "what can you do", study tips) and says plainly that it is in basic mode. It never pretends to explain a subject.
- **Voice test and voice choice.** The live screen has a "Test HIMI's voice" button and a list of installed voices, because browsers differ.
- **English and Telugu.** The interface language and the explanation language are separate settings.
- **Light and dark themes**, plus "Match my device".

### Learning tools

| Tool | Page | What it does |
| --- | --- | --- |
| AI Chat | `/chat` | Subject-aware tutoring chat with saved conversations and optional read-aloud |
| Mentor | `/mentor` | Multi-agent tutor: router, subject tutor and reviewer, with a call, depth and time budget |
| Quiz | `/quiz` | Generates quizzes and records results |
| Study planner | `/study-planner` | Builds a study plan from the student's goals and time |
| Notes | `/notes` | Summarises uploaded PDFs |
| Progress | `/progress` | Learning progress and revision tracking |
| Code assistant | `/code` | Explains, debugs and hints. It reads code and never runs it |
| Diagrams | `/diagrams` | Generates validated diagrams, exports SVG, adds them to the whiteboard |
| Whiteboard | `/whiteboard` | Free-hand and shape board |
| Camera helper | `/camera` | One still photo, taken only when the student asks, explained once and never stored |
| Campus assistant | `/campus` | Answers only from documents the student adds, with a quote the server confirms |
| Classroom | `/classroom` | A solo study room: agenda, notes, tutor Q&A, summary and revision questions |
| Learning memory | `/learning-memory` | The learning profile HIMI uses, which the student can view, edit and delete |
| Profile | `/profile` | Name, language, theme and voice settings |

### How it is built

| Part | Technology |
| --- | --- |
| Frontend | React 19, Vite 5, Tailwind CSS 3.4, Framer Motion |
| Backend | FastAPI (Python) |
| AI | Google Gemini through `google-generativeai` |
| PDF reading | `pypdf` |
| Voice | The browser's speech recognition and speech synthesis (no audio is sent to HIMI's servers) |
| Sign-in | A local demo sign-in with no password |
| Storage | The browser's `localStorage`. There is no database |

---

## Getting started

You need **Node.js 18 or newer** (developed on Node 24), a recent **Python 3** (developed on 3.14) and a **Gemini API key**.

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then put your own GEMINI_API_KEY in .env
uvicorn app.main:app --reload --port 8000
```

`backend/.env` holds your key and is ignored by git. Never commit it. `.env.example` lists the settings, including optional per-feature model names.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The frontend talks to `http://localhost:8000` by default. To use another address, set `VITE_API_BASE_URL`, and add the frontend's address to `ALLOWED_ORIGINS` in `backend/.env`.

### 3. Tests

```bash
# Frontend: lint, unit tests, production build
cd frontend
npm run lint
npm test
npm run build

# Backend
cd backend
python -m unittest discover -s tests -t .
```

The browser-level checks (Playwright against a local build) are not part of this repository.

---

## Honest limits

HIMI is a working prototype. These are the things it does **not** do, so that nothing is promised that is not there:

- **"Live" is not streaming audio.** Live mode is a turn-taking loop built on the browser's speech services plus the Gemini tutor. HIMI does not listen while it speaks (it would hear itself), so you interrupt by tapping. Real low-latency voice, such as the Gemini Live API, is not built.
- **Voice depends on the browser and device.** It was verified with a fake speech engine and by hand on a Mac in Safari. Chrome on one Mac did not start speech at all, which was a problem with that Chrome, not the app. Edge, Firefox, Android, iOS, other microphones and screen readers have **not** been tested. Telugu voices need to be installed on the device.
- **No emotion, attention or gesture detection.** The robot's expressions show what the app is doing, not how the student feels. A self check-in with fixed tips is offered instead.
- **The camera helper is untested on real hardware.** It works on one still photo the student takes on purpose.
- **The classroom is solo.** There are no other participants, video or audio.
- **The campus assistant ships no college data.** It only answers from documents the student adds.
- **No real accounts or database.** Sign-in is a local demo and everything is stored in the browser, so clearing site data erases it.
- **AI can be wrong.** Answers come from Gemini. HIMI's reviewer checks structure, not facts.

---

## Roadmap

**Done**
- Phase 1 – MVP: landing page, sign-in, dashboard, AI chat, voice input, chat history, subject selection, progress card, responsive layout.
- Phase 2: learning memory, study planner, PDF notes and summaries, quiz generator, revision tracking, learning analytics, whiteboard.
- Phase 3 (partly): multi-agent mentor, live coding assistant, diagram generation, robot companion, live mode, basic-mode fallback, English and Telugu, campus assistant, solo classroom, camera photo helper, light and dark themes.

**Not built yet**
- Real-time computer vision: face detection, emotion recognition, attention tracking, gesture recognition.
- Streaming voice conversation (Gemini Live API) with true hands-free, full-duplex talking.
- Real accounts and a database for memory (for example a vector store with retrieval).
- A multi-user virtual classroom.
- A Live2D or 3D avatar. The current robot is a lightweight SVG.
- Deployment setup (for example Vercel, Railway or Docker).

The original plan also named MongoDB, Firebase Authentication, MediaPipe, OpenCV and Whisper. None of these are used today.

---

## Repository layout

```text
himi-interactive-model/
├── frontend/   React app (pages, components, hooks, i18n, tests next to the code)
├── backend/    FastAPI app (api routes, agents, services, schemas) and unit tests
├── docs/       PHASE3.md: status, limits and manual checks
├── assets/     Reserved for project assets (currently empty)
├── LICENSE
└── README.md
```

---

## Long-term vision

HIMI is meant to grow into a trusted digital mentor that combines perception, reasoning, memory and personalised guidance in one platform, supporting engineering students through their whole learning journey, and later schools, medical education and corporate learning.
