/**
 * Saved summaries, stored ONLY in this browser. Only the summary is saved: never the PDF file and never the
 * extracted document text. Versioned, validated on load, with a recovery backup for unreadable data.
 */
import { normalizeNotesSummary } from './notes.js';

export const NOTES_STORAGE_KEY = 'himi_notes_summaries_v1';
export const NOTES_BACKUP_KEY = 'himi_notes_summaries_v1_unreadable_backup';
export const NOTES_STORAGE_VERSION = 1;
export const MAX_SAVED_SUMMARIES = 20;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const ID_PATTERN = /^[\w-]{1,64}$/;

function getBrowserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const cleanLabel = (value, max) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** @returns {object | null} a clean record, or null when the stored item is unusable. */
export function parseSummaryRecord(raw) {
  if (!isObject(raw) || typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) {
    return null;
  }

  const notes = normalizeNotesSummary(raw.notes);

  if (!notes) {
    return null;
  }

  const createdAt = typeof raw.createdAt === 'string' && !Number.isNaN(Date.parse(raw.createdAt)) ? raw.createdAt : new Date(0).toISOString();
  const fileName = cleanLabel(raw.fileName, 200);

  return {
    id: raw.id,
    title: cleanLabel(raw.title, 120) || fileName || 'Untitled notes',
    fileName,
    pageCount: Number.isInteger(raw.pageCount) && raw.pageCount >= 0 ? raw.pageCount : 0,
    createdAt,
    notes
  };
}

/** @returns {{records: object[], issue: null | 'unavailable' | 'unreadable' | 'partial', skipped: number}} */
export function loadSavedSummaries(storage = getBrowserStorage()) {
  const empty = { records: [], issue: null, skipped: 0 };

  if (!storage) {
    return { ...empty, issue: 'unavailable' };
  }

  let raw;

  try {
    raw = storage.getItem(NOTES_STORAGE_KEY);
  } catch {
    return { ...empty, issue: 'unavailable' };
  }

  if (raw === null || raw === undefined) {
    return empty;
  }

  const keepBackup = () => {
    try {
      storage.setItem(NOTES_BACKUP_KEY, raw);
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

  if (!isObject(parsed) || parsed.version !== NOTES_STORAGE_VERSION || !Array.isArray(parsed.summaries)) {
    keepBackup();
    return { ...empty, issue: 'unreadable' };
  }

  const seen = new Set();
  const records = [];
  let skipped = 0;

  for (const item of parsed.summaries) {
    const record = parseSummaryRecord(item);

    if (!record || seen.has(record.id) || records.length >= MAX_SAVED_SUMMARIES) {
      skipped += 1;
      continue;
    }

    seen.add(record.id);
    records.push(record);
  }

  if (skipped > 0) {
    keepBackup();
  }

  return { records, issue: skipped > 0 ? 'partial' : null, skipped };
}

/** Returns false when the browser refuses the write. */
export function saveSummaries(records, storage = getBrowserStorage()) {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(NOTES_STORAGE_KEY, JSON.stringify({ version: NOTES_STORAGE_VERSION, summaries: records }));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedSummaries(storage = getBrowserStorage()) {
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(NOTES_STORAGE_KEY);
    storage.removeItem(NOTES_BACKUP_KEY);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------ pure list updates */

export const canAddSummary = (records) => records.length < MAX_SAVED_SUMMARIES;

/** Build a record from a finished summary. Only the summary and a few labels are kept. */
export function createSummaryRecord({ id, title, fileName, pageCount, notes }, now = new Date()) {
  return parseSummaryRecord({ id, title, fileName, pageCount, notes, createdAt: now.toISOString() });
}

/** Newest first. Callers should check `canAddSummary` first. */
export const addSummaryRecord = (records, record) => [record, ...records.filter((item) => item.id !== record.id)];

export const removeSummaryRecord = (records, id) => records.filter((record) => record.id !== id);
