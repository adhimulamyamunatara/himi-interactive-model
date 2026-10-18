/**
 * Local persistence for study plans. Plans live ONLY in this browser (no account, no cloud backup).
 *
 * - One dedicated, versioned key; the user, chat and quiz keys are never touched.
 * - Every record is re-validated on load, so malformed or tampered data can never crash the app.
 * - All list updates are pure functions that change only the plan being edited.
 * - The storage object is injectable so the logic can be tested without a browser.
 */
import { SUBJECTS } from './subjects.js';
import {
  ALL_WEEKDAY_KEYS,
  CONFIDENCE_LEVELS,
  DEFAULT_CONFIDENCE,
  normalizePlan
} from './studyPlanner.js';

export const STUDY_PLANS_STORAGE_KEY = 'himi_study_plans_v1';
export const STUDY_PLANS_BACKUP_KEY = 'himi_study_plans_v1_unreadable_backup';
export const STORAGE_VERSION = 1;
export const MAX_SAVED_PLANS = 20;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const RECORD_ID_PATTERN = /^[\w-]{1,64}$/;

function getBrowserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // access can throw when storage is blocked
  }
}

/** The form values that would recreate this plan, used when stored form values are missing or invalid. */
export function configFromPlan(plan) {
  return {
    title: plan.title,
    examDate: plan.exam_date,
    subjects: plan.subjects.map((subject) => ({ subject, topics: '', confidence: DEFAULT_CONFIDENCE })),
    dailyMinutes: plan.daily_available_minutes,
    studyDays: [...plan.preferred_study_days],
    instructions: ''
  };
}

function isValidConfig(config) {
  return (
    isObject(config) &&
    typeof config.title === 'string' &&
    typeof config.examDate === 'string' &&
    typeof config.instructions === 'string' &&
    Number.isInteger(config.dailyMinutes) &&
    Array.isArray(config.studyDays) &&
    config.studyDays.length > 0 &&
    config.studyDays.every((day) => ALL_WEEKDAY_KEYS.includes(day)) &&
    Array.isArray(config.subjects) &&
    config.subjects.length > 0 &&
    config.subjects.every(
      (item) =>
        isObject(item) &&
        SUBJECTS.includes(item.subject) &&
        typeof item.topics === 'string' &&
        CONFIDENCE_LEVELS.some((level) => level.value === item.confidence)
    )
  );
}

/** Keep stored form values only when they are well formed; otherwise rebuild them from the plan. */
export function sanitizeConfig(config, plan) {
  if (!isValidConfig(config)) {
    return configFromPlan(plan);
  }

  return {
    title: config.title,
    examDate: config.examDate,
    subjects: config.subjects.map(({ subject, topics, confidence }) => ({ subject, topics, confidence })),
    dailyMinutes: config.dailyMinutes,
    studyDays: [...config.studyDays],
    instructions: config.instructions
  };
}

/** @returns {object | null} a clean record, or null when the stored item is unusable. */
export function parseRecord(raw) {
  if (!isObject(raw) || typeof raw.id !== 'string' || !RECORD_ID_PATTERN.test(raw.id)) {
    return null;
  }

  let plan;

  try {
    plan = normalizePlan(raw.plan);
  } catch {
    return null;
  }

  const fallbackTime = new Date(0).toISOString();
  const validTime = (value) => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallbackTime);

  return {
    id: raw.id,
    title: plan.title,
    createdAt: validTime(raw.createdAt),
    updatedAt: validTime(raw.updatedAt),
    config: sanitizeConfig(raw.config, plan),
    plan
  };
}

/**
 * Read saved plans. Never throws.
 *
 * @returns {{plans: object[], issue: null | 'unavailable' | 'unreadable' | 'partial', skipped: number}}
 *   `issue` explains why data was missing: storage blocked, the whole payload unreadable, or some plans skipped.
 */
export function loadStudyPlans(storage = getBrowserStorage()) {
  const empty = { plans: [], issue: null, skipped: 0 };

  if (!storage) {
    return { ...empty, issue: 'unavailable' };
  }

  let raw;

  try {
    raw = storage.getItem(STUDY_PLANS_STORAGE_KEY);
  } catch {
    return { ...empty, issue: 'unavailable' };
  }

  if (raw === null || raw === undefined) {
    return empty;
  }

  // Keep a copy of anything we cannot fully read so a later save does not silently destroy it.
  const keepBackup = () => {
    try {
      storage.setItem(STUDY_PLANS_BACKUP_KEY, raw);
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

  if (!isObject(parsed) || parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.plans)) {
    keepBackup();
    return { ...empty, issue: 'unreadable' };
  }

  const seen = new Set();
  const plans = [];
  let skipped = 0;

  for (const item of parsed.plans) {
    const record = parseRecord(item);

    if (!record || seen.has(record.id) || plans.length >= MAX_SAVED_PLANS) {
      skipped += 1;
      continue;
    }

    seen.add(record.id);
    plans.push(record);
  }

  if (skipped > 0) {
    keepBackup();
  }

  return { plans, issue: skipped > 0 ? 'partial' : null, skipped };
}

/** Write all plans. Returns false when the browser refuses (quota exceeded, storage blocked). */
export function saveStudyPlans(plans, storage = getBrowserStorage()) {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(STUDY_PLANS_STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, plans }));
    return true;
  } catch {
    return false;
  }
}

/* ----------------------------------------------------- pure list updates */

const toIso = (now) => now.toISOString();

/** @param {object} plan a validated plan from the API  @param {object} config the form values used */
export function createPlanRecord(plan, config, now = new Date()) {
  return {
    id: plan.id,
    title: plan.title,
    createdAt: toIso(now),
    updatedAt: toIso(now),
    config,
    plan
  };
}

export const canAddPlan = (records) => records.length < MAX_SAVED_PLANS;

export const findPlanRecord = (records, id) => records.find((record) => record.id === id) ?? null;

/** Newest first. Callers should check `canAddPlan` first. */
export const addPlanRecord = (records, record) => [record, ...records.filter((item) => item.id !== record.id)];

/** Replace the schedule (and form values) of ONE plan, keeping its id and creation time. */
export function replacePlanContent(records, id, plan, config, now = new Date()) {
  return records.map((record) =>
    record.id === id ? { ...record, title: plan.title, updatedAt: toIso(now), config, plan } : record
  );
}

/** Store an updated plan object (for example after ticking a task) for ONE record only. */
export function updatePlanInRecords(records, id, plan, now = new Date()) {
  return records.map((record) => (record.id === id ? { ...record, updatedAt: toIso(now), plan } : record));
}

export const removePlanRecord = (records, id) => records.filter((record) => record.id !== id);
