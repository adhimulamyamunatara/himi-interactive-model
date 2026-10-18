/**
 * Whiteboard persistence. Stored ONLY in this browser (no account, no cloud sync).
 *
 * - One versioned key holding the vector shapes (never an image), bounded by the limits in `whiteboard.js`.
 * - Stored values are re-validated on load; invalid shapes are skipped and an unreadable value is backed up
 *   under a separate key instead of being overwritten silently.
 * - Undo history is not stored: after a reload the board starts a fresh history.
 */
import { parseShapes } from './whiteboard.js';

export const WHITEBOARD_STORAGE_KEY = 'himi_whiteboard_v1';
export const WHITEBOARD_BACKUP_KEY = 'himi_whiteboard_v1_unreadable_backup';
export const WHITEBOARD_STORAGE_VERSION = 1;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

function getBrowserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** @returns {{ shapes: object[], issue: null | 'unavailable' | 'unreadable' | 'partial', skipped: number }} */
export function loadWhiteboard(storage = getBrowserStorage()) {
  const empty = { shapes: [], issue: null, skipped: 0 };

  if (!storage) {
    return { ...empty, issue: 'unavailable' };
  }

  let raw;

  try {
    raw = storage.getItem(WHITEBOARD_STORAGE_KEY);
  } catch {
    return { ...empty, issue: 'unavailable' };
  }

  if (raw === null || raw === undefined) {
    return empty;
  }

  const keepBackup = () => {
    try {
      storage.setItem(WHITEBOARD_BACKUP_KEY, raw);
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

  if (!isObject(parsed) || parsed.version !== WHITEBOARD_STORAGE_VERSION || !Array.isArray(parsed.shapes)) {
    keepBackup();
    return { ...empty, issue: 'unreadable' };
  }

  const { shapes, skipped } = parseShapes(parsed.shapes);

  if (skipped > 0) {
    keepBackup();
  }

  return { shapes, issue: skipped > 0 ? 'partial' : null, skipped };
}

/** @returns {{ ok: true } | { ok: false, reason: 'unavailable' | 'full' }} */
export function saveWhiteboard(shapes, storage = getBrowserStorage()) {
  if (!storage) {
    return { ok: false, reason: 'unavailable' };
  }

  try {
    if (shapes.length === 0) {
      storage.removeItem(WHITEBOARD_STORAGE_KEY);
    } else {
      storage.setItem(WHITEBOARD_STORAGE_KEY, JSON.stringify({ version: WHITEBOARD_STORAGE_VERSION, savedAt: new Date().toISOString(), shapes }));
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: 'full' };
  }
}

export function clearStoredWhiteboard(storage = getBrowserStorage()) {
  try {
    storage?.removeItem(WHITEBOARD_STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}
