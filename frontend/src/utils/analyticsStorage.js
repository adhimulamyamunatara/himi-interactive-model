/**
 * Quiz attempt history for the progress page. Stored ONLY in this browser (no account, no cloud sync).
 *
 * - One dedicated, versioned key. Study plans stay in their own store; analytics only reads them.
 * - Every attempt has a unique id, so recording the same quiz twice can never double count it.
 * - Stored values are re-validated on load. The percentage is always recomputed, never trusted.
 * - Only scores and labels are kept: never questions, answers or any document text.
 */
import { SUBJECTS } from './subjects.js';

export const ATTEMPTS_STORAGE_KEY = 'himi_quiz_attempts_v1';
export const ATTEMPTS_BACKUP_KEY = 'himi_quiz_attempts_v1_unreadable_backup';
export const ATTEMPTS_STORAGE_VERSION = 1;
export const MAX_STORED_ATTEMPTS = 500; // the oldest attempts are dropped beyond this
export const MAX_ATTEMPT_TOPIC_LENGTH = 100;

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const ID_PATTERN = /^[\w-]{1,64}$/;
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

function getBrowserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** @returns {object | null} a clean attempt, or null when the stored item is unusable. */
export function parseAttempt(raw) {
  if (!isObject(raw) || typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) {
    return null;
  }

  if (typeof raw.submittedAt !== 'string' || Number.isNaN(Date.parse(raw.submittedAt))) {
    return null;
  }

  if (!SUBJECTS.includes(raw.subject) || !DIFFICULTIES.includes(raw.difficulty)) {
    return null;
  }

  const { total, correct, unanswered } = raw;

  if (
    !Number.isInteger(total) ||
    total < 1 ||
    total > 100 ||
    !Number.isInteger(correct) ||
    correct < 0 ||
    !Number.isInteger(unanswered) ||
    unanswered < 0 ||
    correct + unanswered > total
  ) {
    return null;
  }

  const topic = typeof raw.topic === 'string' ? raw.topic.replace(/\s+/g, ' ').trim().slice(0, MAX_ATTEMPT_TOPIC_LENGTH) : '';

  return {
    id: raw.id,
    submittedAt: new Date(raw.submittedAt).toISOString(),
    subject: raw.subject,
    topic: topic || null,
    difficulty: raw.difficulty,
    total,
    correct,
    unanswered,
    percentage: (correct / total) * 100
  };
}

/** @returns {{attempts: object[], issue: null | 'unavailable' | 'unreadable' | 'partial', skipped: number}} */
export function loadQuizAttempts(storage = getBrowserStorage()) {
  const empty = { attempts: [], issue: null, skipped: 0 };

  if (!storage) {
    return { ...empty, issue: 'unavailable' };
  }

  let raw;

  try {
    raw = storage.getItem(ATTEMPTS_STORAGE_KEY);
  } catch {
    return { ...empty, issue: 'unavailable' };
  }

  if (raw === null || raw === undefined) {
    return empty;
  }

  const keepBackup = () => {
    try {
      storage.setItem(ATTEMPTS_BACKUP_KEY, raw);
    } catch {
      /* best effort */
    }
  };

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    keepBackup();
    return { ...empty, issue: 'unreadable' };
  }

  if (!isObject(parsed) || parsed.version !== ATTEMPTS_STORAGE_VERSION || !Array.isArray(parsed.attempts)) {
    keepBackup();
    return { ...empty, issue: 'unreadable' };
  }

  const seen = new Set();
  const attempts = [];
  let skipped = 0;

  for (const item of parsed.attempts) {
    const attempt = parseAttempt(item);

    if (!attempt || seen.has(attempt.id)) {
      skipped += 1; // invalid, or a duplicate id (never counted twice)
      continue;
    }

    seen.add(attempt.id);
    attempts.push(attempt);
  }

  if (skipped > 0) {
    keepBackup();
  }

  return { attempts: attempts.slice(-MAX_STORED_ATTEMPTS), issue: skipped > 0 ? 'partial' : null, skipped };
}

function writeAttempts(attempts, storage) {
  try {
    storage.setItem(ATTEMPTS_STORAGE_KEY, JSON.stringify({ version: ATTEMPTS_STORAGE_VERSION, attempts }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Record one finished quiz. Safe to call more than once for the same quiz: the second call changes nothing.
 *
 * @param {{id: string, submittedAt: string, subject: string, topic: string | null, difficulty: string,
 *          total: number, correct: number, unanswered: number}} attempt
 * @returns {{recorded: boolean, reason: null | 'duplicate' | 'invalid' | 'storage'}}
 */
export function recordQuizAttempt(attempt, storage = getBrowserStorage()) {
  const clean = parseAttempt(attempt);

  if (!clean) {
    return { recorded: false, reason: 'invalid' };
  }

  if (!storage) {
    return { recorded: false, reason: 'storage' };
  }

  const { attempts } = loadQuizAttempts(storage);

  if (attempts.some((item) => item.id === clean.id)) {
    return { recorded: false, reason: 'duplicate' };
  }

  const next = [...attempts, clean].slice(-MAX_STORED_ATTEMPTS);
  return writeAttempts(next, storage) ? { recorded: true, reason: null } : { recorded: false, reason: 'storage' };
}

/** Delete the quiz history and its recovery copy. Study plans are not touched. */
export function clearQuizAttempts(storage = getBrowserStorage()) {
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(ATTEMPTS_STORAGE_KEY);
    storage.removeItem(ATTEMPTS_BACKUP_KEY);
    return true;
  } catch {
    return false;
  }
}
