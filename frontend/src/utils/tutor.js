/**
 * Pure helpers for the AI Mentor: building requests, validating the (untrusted) response, and mapping the
 * tutor's suggested actions onto existing HIMI pages. Nothing here touches the network or the browser.
 */
import { prepareAttempts, REVISION_THRESHOLD, topicsNeedingRevision } from './analytics.js';

export const MAX_MESSAGE_CHARS = 2000;
export const MAX_TOPIC_CHARS = 80;
export const MAX_HISTORY_TURNS = 6;
export const MAX_HISTORY_CHARS = 1500;
export const MAX_ANSWER_CHARS = 6000;

const INTENTS = ['explain', 'hint', 'worked_example', 'revision', 'quiz', 'planner', 'clarify'];
const OUTCOMES = ['answer', 'clarify', 'handoff'];
const STEP_KINDS = ['learn', 'example', 'practice', 'check'];
const ACTION_KINDS = ['quiz', 'planner', 'notes', 'whiteboard', 'diagram'];
const TRACE_STATUSES = ['ok', 'skipped', 'retry', 'flagged', 'fallback'];

export class InvalidTutorResponseError extends Error {
  constructor(message = 'The tutor response was not in the expected format.') {
    super(message);
    this.name = 'InvalidTutorResponseError';
  }
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value, max) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);

/* ------------------------------------------------------------------ request */

/**
 * @param {object} input
 * @param {string} input.message
 * @param {string} input.subject
 * @param {string} [input.topic]
 * @param {string} input.userName
 * @param {'en' | 'te'} input.language
 * @param {'hint' | 'guided' | 'full'} input.helpMode
 * @param {Array<{role: 'user' | 'assistant', content: string}>} [input.history]
 * @param {{attempts: number, averagePercent: number | null, weakTopics: string[]} | null} [input.progress]
 */
export function buildTutorRequest({ message, subject, topic, userName, language, helpMode, history = [], progress = null }) {
  const request = {
    message: message.trim().slice(0, MAX_MESSAGE_CHARS),
    subject,
    userName: userName.trim().slice(0, 60) || 'Student',
    language,
    helpMode,
    history: history
      .slice(-MAX_HISTORY_TURNS)
      .map((turn) => ({ role: turn.role, content: turn.content.slice(0, MAX_HISTORY_CHARS) }))
  };
  const cleanTopic = (topic ?? '').trim().slice(0, MAX_TOPIC_CHARS);

  if (cleanTopic) {
    request.topic = cleanTopic;
  }

  if (progress) {
    request.progress = progress;
  }

  return request;
}

/**
 * Progress figures for one subject, computed only from the student's recorded quiz attempts.
 * Returns null when there are none, so the tutor is never given an invented level.
 */
export function buildProgressSummary(attempts, subject) {
  const own = prepareAttempts(attempts).filter((attempt) => attempt.subject === subject);

  if (own.length === 0) {
    return null;
  }

  const average = Math.round(own.reduce((sum, attempt) => sum + attempt.percentage, 0) / own.length);
  const weakTopics = topicsNeedingRevision(own, { threshold: REVISION_THRESHOLD })
    .map((item) => item.topic)
    .filter(Boolean)
    .slice(0, 5);

  return { attempts: own.length, averagePercent: Math.max(0, Math.min(100, average)), weakTopics };
}

/* ----------------------------------------------------------------- response */

function parsePlan(raw) {
  if (!isObject(raw)) {
    throw new InvalidTutorResponseError('Missing plan.');
  }

  const goal = text(raw.goal, 250);
  const steps = Array.isArray(raw.steps) ? raw.steps : [];

  if (!goal || steps.length < 1 || steps.length > 6) {
    throw new InvalidTutorResponseError('Invalid plan.');
  }

  return {
    goal,
    steps: steps.map((step) => {
      const title = isObject(step) ? text(step.title, 100) : null;
      const detail = isObject(step) ? text(step.detail, 500) : null;

      if (!title || !detail) {
        throw new InvalidTutorResponseError('Invalid plan step.');
      }

      return { title, detail, kind: STEP_KINDS.includes(step.kind) ? step.kind : 'learn' };
    })
  };
}

const parseActions = (raw) =>
  (Array.isArray(raw) ? raw : []).flatMap((item) =>
    isObject(item) && ACTION_KINDS.includes(item.kind)
      ? [{ kind: item.kind, label: text(item.label, 80), topic: text(item.topic, MAX_TOPIC_CHARS) }]
      : []
  );

const parseStrings = (raw, max, limit) =>
  (Array.isArray(raw) ? raw : []).flatMap((item) => {
    const cleaned = text(item, max);
    return cleaned ? [cleaned] : [];
  }).slice(0, limit);

function parseTrace(raw) {
  return (Array.isArray(raw) ? raw : []).flatMap((entry) =>
    isObject(entry) && text(entry.agent, 40) && text(entry.action, 60) && TRACE_STATUSES.includes(entry.status)
      ? [{ agent: entry.agent, action: entry.action, status: entry.status, ms: Number.isFinite(entry.ms) ? Math.max(0, Math.round(entry.ms)) : 0 }]
      : []
  );
}

/**
 * Validate a `/api/tutor/respond` payload before any of it reaches the UI.
 * @throws {InvalidTutorResponseError}
 */
export function parseTutorResponse(data) {
  if (!isObject(data) || !OUTCOMES.includes(data.outcome) || !INTENTS.includes(data.intent)) {
    throw new InvalidTutorResponseError();
  }

  const common = {
    requestId: text(data.requestId, 40) ?? '',
    outcome: data.outcome,
    intent: data.intent,
    agent: text(data.agent, 40) ?? 'orchestrator',
    language: data.language === 'te' ? 'te' : 'en',
    trace: parseTrace(data.trace),
    modelCalls: Number.isFinite(data.modelCalls) ? Math.max(0, Math.round(data.modelCalls)) : 0
  };

  if (data.outcome === 'clarify') {
    return { ...common, clarify: { reason: 'too_vague' } };
  }

  if (data.outcome === 'handoff') {
    const handoff = data.handoff;

    if (!isObject(handoff) || !['quiz', 'planner'].includes(handoff.kind)) {
      throw new InvalidTutorResponseError('Invalid handoff.');
    }

    return { ...common, handoff: { kind: handoff.kind, subject: text(handoff.subject, 60) ?? '', topic: text(handoff.topic, MAX_TOPIC_CHARS) } };
  }

  const answer = text(data.answer, MAX_ANSWER_CHARS);

  if (!answer) {
    throw new InvalidTutorResponseError('Missing answer.');
  }

  const review = isObject(data.review)
    ? { passed: data.review.passed === true, issues: parseStrings(data.review.issues, 300, 6) }
    : null;

  return {
    ...common,
    answer,
    plan: parsePlan(data.plan),
    followUps: parseStrings(data.followUps, 160, 3),
    clarifyingQuestion: text(data.clarifyingQuestion, 300),
    suggestedActions: parseActions(data.suggestedActions).slice(0, 3),
    review
  };
}

/* ------------------------------------------------------------------ actions */

const query = (params) => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  const serialised = search.toString();
  return serialised ? `?${serialised}` : '';
};

/** The existing HIMI page a suggested action opens, or null for an unknown kind. */
export function actionRoute(kind, { subject, topic } = {}) {
  switch (kind) {
    case 'quiz':
      return `/quiz${query({ subject, topic })}`;
    case 'planner':
      return `/study-planner${query({ subject, topic })}`;
    case 'notes':
      return '/notes';
    case 'whiteboard':
      return '/whiteboard';
    case 'diagram':
      return `/diagrams${query({ subject, topic })}`;
    default:
      return null;
  }
}

/** Translation key of the default label for an action (used when the model gave none). */
export const actionLabelKey = (kind) => `mentor.action.${kind}`;
