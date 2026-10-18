/**
 * Virtual Classroom (local, single student). A "room" is one study session kept in this browser:
 * an agenda, shared notes, tutor questions and answers, and an optional generated summary.
 * It is NOT multi-user: there are no other participants, no video and no audio. Pure and framework-free.
 */

export const CLASSROOM_STORAGE_KEY = 'himi_classroom_v1';
export const CLASSROOM_STORAGE_VERSION = 1;
export const MAX_TITLE = 100;
export const MAX_AGENDA_ITEMS = 10;
export const MAX_AGENDA_CHARS = 120;
export const MAX_NOTES = 5000;
export const MAX_QUESTIONS = 8;
export const MAX_QA_CHARS = 800;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
// eslint-disable-next-line no-control-regex
const oneLine = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
// eslint-disable-next-line no-control-regex
const multiline = (value, max) => String(value ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max);

export const createRoomId = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** @returns {{ok: true, room: object} | {ok: false, error: 'title' | 'subject'}} */
export function createRoom({ title, subject, agenda = [] }, { subjects, id = createRoomId(), now = new Date() } = {}) {
  const cleanTitle = oneLine(title, MAX_TITLE);

  if (!cleanTitle) {
    return { ok: false, error: 'title' };
  }

  if (subjects && !subjects.includes(subject)) {
    return { ok: false, error: 'subject' };
  }

  const items = agenda
    .map((item) => oneLine(item, MAX_AGENDA_CHARS))
    .filter(Boolean)
    .slice(0, MAX_AGENDA_ITEMS)
    .map((text, index) => ({ id: `a${index}`, text, done: false }));

  return {
    ok: true,
    room: { id, title: cleanTitle, subject, createdAt: now.toISOString(), agenda: items, notes: '', questions: [], summary: null }
  };
}

/** Split a multi-line textarea into agenda items. */
export const parseAgendaText = (value) => String(value ?? '').split('\n').map((line) => oneLine(line.replace(/^[-*\d.)\s]+/, ''), MAX_AGENDA_CHARS)).filter(Boolean).slice(0, MAX_AGENDA_ITEMS);

export const setNotes = (room, notes) => ({ ...room, notes: multiline(notes, MAX_NOTES), summary: room.summary });

export function toggleAgenda(room, itemId) {
  return { ...room, agenda: room.agenda.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)) };
}

/** Append a question and the tutor's answer. Returns the same room when the limit is reached. */
export function addQuestion(room, { question, answer }) {
  if (room.questions.length >= MAX_QUESTIONS) {
    return { room, added: false };
  }

  const entry = { id: `q${room.questions.length}`, question: oneLine(question, MAX_QA_CHARS), answer: String(answer ?? '').trim().slice(0, MAX_QA_CHARS) };
  return entry.question ? { room: { ...room, questions: [...room.questions, entry] }, added: true } : { room, added: false };
}

export const setSummary = (room, summary) => ({ ...room, summary });

/** Add a line to the shared notes without overwriting what the student wrote. */
export function appendToNotes(room, line) {
  const next = room.notes ? `${room.notes.replace(/\s+$/, '')}\n${line}` : line;
  return next.length > MAX_NOTES ? { room, added: false } : { room: { ...room, notes: next }, added: true };
}

export function buildSummaryRequest(room, language) {
  return {
    title: room.title,
    subject: room.subject,
    agenda: room.agenda.map((item) => item.text),
    notes: room.notes.slice(0, MAX_NOTES),
    questions: room.questions.map((entry) => ({ question: entry.question, answer: entry.answer })),
    language
  };
}

/** True when there is something worth summarising. */
export const hasSessionContent = (room) => room.notes.trim().length > 0 || room.questions.length > 0 || room.agenda.some((item) => item.done);

export class InvalidSummaryError extends Error {
  constructor(message = 'The summary was not in the expected format.') {
    super(message);
    this.name = 'InvalidSummaryError';
  }
}

export function parseSummaryResponse(data) {
  const summary = isObject(data) && typeof data.summary === 'string' ? data.summary.trim().slice(0, 1500) : '';

  if (!summary) {
    throw new InvalidSummaryError();
  }

  const strings = (value, max, limit) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim().slice(0, max)).slice(0, limit) : []);
  const questions = (Array.isArray(data.revisionQuestions) ? data.revisionQuestions : [])
    .filter((item) => isObject(item) && typeof item.question === 'string' && item.question.trim())
    .map((item) => ({ question: item.question.trim().slice(0, 300), hint: typeof item.hint === 'string' ? item.hint.trim().slice(0, 300) : '' }))
    .slice(0, 6);

  return { summary, keyPoints: strings(data.keyPoints, 240, 8), revisionQuestions: questions };
}

/* ----------------------------------------------------------------- storage */

export const getBrowserStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

function parseRoom(raw) {
  if (!isObject(raw) || typeof raw.id !== 'string' || !oneLine(raw.title, MAX_TITLE) || typeof raw.subject !== 'string') {
    return null;
  }

  const agenda = (Array.isArray(raw.agenda) ? raw.agenda : [])
    .filter((item) => isObject(item) && oneLine(item.text, MAX_AGENDA_CHARS))
    .slice(0, MAX_AGENDA_ITEMS)
    .map((item, index) => ({ id: `a${index}`, text: oneLine(item.text, MAX_AGENDA_CHARS), done: item.done === true }));
  const questions = (Array.isArray(raw.questions) ? raw.questions : [])
    .filter((item) => isObject(item) && oneLine(item.question, MAX_QA_CHARS))
    .slice(0, MAX_QUESTIONS)
    .map((item, index) => ({ id: `q${index}`, question: oneLine(item.question, MAX_QA_CHARS), answer: String(item.answer ?? '').slice(0, MAX_QA_CHARS) }));

  let summary = null;

  try {
    summary = raw.summary ? parseSummaryResponse(raw.summary) : null;
  } catch {
    summary = null;
  }

  return {
    id: raw.id.slice(0, 40),
    title: oneLine(raw.title, MAX_TITLE),
    subject: raw.subject.slice(0, 60),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
    agenda,
    notes: multiline(raw.notes, MAX_NOTES),
    questions,
    summary
  };
}

/** Never throws. `issue` is 'unavailable' | 'unreadable' | null. */
export function loadRoom(storage = getBrowserStorage()) {
  if (!storage) {
    return { room: null, issue: 'unavailable' };
  }

  try {
    const raw = storage.getItem(CLASSROOM_STORAGE_KEY);

    if (raw === null) {
      return { room: null, issue: null };
    }

    const parsed = JSON.parse(raw);
    const room = isObject(parsed) && parsed.version === CLASSROOM_STORAGE_VERSION ? parseRoom(parsed.room) : null;
    return room ? { room, issue: null } : { room: null, issue: 'unreadable' };
  } catch {
    return { room: null, issue: 'unreadable' };
  }
}

export function saveRoom(room, storage = getBrowserStorage()) {
  if (!storage) {
    return { ok: false };
  }

  try {
    if (room) {
      storage.setItem(CLASSROOM_STORAGE_KEY, JSON.stringify({ version: CLASSROOM_STORAGE_VERSION, room }));
    } else {
      storage.removeItem(CLASSROOM_STORAGE_KEY);
    }

    return { ok: true };
  } catch {
    return { ok: false };
  }
}
