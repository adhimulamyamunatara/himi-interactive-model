/**
 * Learning memory: the preferences a student chose on purpose, used to personalise AI answers.
 *
 * - Everything here is plain data and pure functions (no browser APIs), so it is easy to test.
 * - Nothing is inferred about the student: only values the student entered are ever stored or sent.
 * - Limits mirror the backend schema, so a payload built here is always accepted by the API.
 */
import { SUBJECTS } from './subjects.js';

export const EXPLANATION_LEVELS = [
  { value: 'beginner', label: 'Beginner', description: 'Plain words, little jargon, basics first.' },
  { value: 'intermediate', label: 'Intermediate', description: 'Balanced depth, standard terminology.' },
  { value: 'advanced', label: 'Advanced', description: 'Technical depth, edge cases and trade-offs.' }
];

export const EXPLANATION_STYLES = [
  { value: 'step_by_step', label: 'Step by step' },
  { value: 'examples_first', label: 'Examples first' },
  { value: 'concise', label: 'Short and concise' },
  { value: 'detailed', label: 'Detailed' }
];

export const EXPLANATION_LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'telugu_english', label: 'Telugu + English mix' }
];

export const QUIZ_STYLES = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'conceptual', label: 'Conceptual' },
  { value: 'practical', label: 'Practical / applied' }
];

export const REVISION_STYLES = [
  { value: 'summaries', label: 'Summaries' },
  { value: 'practice_questions', label: 'Practice questions' },
  { value: 'flashcards', label: 'Flashcards' },
  { value: 'spaced_review', label: 'Spaced review' }
];

export const MAX_GOALS = 5;
export const MAX_GOAL_LENGTH = 120;
export const MAX_INTERESTS = 10;
export const MAX_INTEREST_LENGTH = 60;
export const MAX_DIFFICULT_TOPICS = 15;
export const MAX_TOPIC_LENGTH = 80;

const values = (options) => options.map((option) => option.value);
const pick = (value, options, fallback) => (values(options).includes(value) ? value : fallback);
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

// Control characters (including newlines) are never useful in profile text.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;

/** Collapse whitespace and drop control characters. */
export function cleanText(value) {
  return typeof value === 'string' ? value.replace(CONTROL_CHARACTERS, ' ').replace(/\s+/g, ' ').trim() : '';
}

export function createDefaultProfile() {
  return {
    explanationLevel: 'intermediate',
    explanationStyle: 'step_by_step',
    language: 'english',
    quizStyle: 'mixed',
    revisionStyle: 'practice_questions',
    goals: [],
    interests: [],
    difficultTopics: []
  };
}

function normalizeStringList(raw, maxItems, maxLength) {
  const seen = new Set();
  const list = [];

  for (const item of Array.isArray(raw) ? raw : []) {
    const text = cleanText(item).slice(0, maxLength).trim();
    const key = text.toLowerCase();

    if (!text || seen.has(key) || list.length >= maxItems) {
      continue;
    }

    seen.add(key);
    list.push(text);
  }

  return list;
}

function normalizeTopics(raw) {
  const seen = new Set();
  const list = [];

  for (const item of Array.isArray(raw) ? raw : []) {
    if (!isObject(item)) {
      continue;
    }

    const topic = cleanText(item.topic).slice(0, MAX_TOPIC_LENGTH).trim();
    const subject = SUBJECTS.includes(item.subject) ? item.subject : null;
    const key = `${subject ?? ''}|${topic.toLowerCase()}`;

    if (!topic || seen.has(key) || list.length >= MAX_DIFFICULT_TOPICS) {
      continue;
    }

    seen.add(key);
    list.push({ subject, topic });
  }

  return list;
}

/**
 * Turn anything (stored data, imported data) into a valid profile.
 * Unknown values fall back to the defaults; text is cleaned, de-duplicated and capped.
 */
export function normalizeProfile(raw) {
  const defaults = createDefaultProfile();
  const source = isObject(raw) ? raw : {};

  return {
    explanationLevel: pick(source.explanationLevel, EXPLANATION_LEVELS, defaults.explanationLevel),
    explanationStyle: pick(source.explanationStyle, EXPLANATION_STYLES, defaults.explanationStyle),
    language: pick(source.language, EXPLANATION_LANGUAGES, defaults.language),
    quizStyle: pick(source.quizStyle, QUIZ_STYLES, defaults.quizStyle),
    revisionStyle: pick(source.revisionStyle, REVISION_STYLES, defaults.revisionStyle),
    goals: normalizeStringList(source.goals, MAX_GOALS, MAX_GOAL_LENGTH),
    interests: normalizeStringList(source.interests, MAX_INTERESTS, MAX_INTEREST_LENGTH),
    difficultTopics: normalizeTopics(source.difficultTopics)
  };
}

/** True when the profile differs from the defaults (the student has actually told HIMI something). */
export function hasProfileContent(profile) {
  const defaults = createDefaultProfile();
  return JSON.stringify(normalizeProfile(profile)) !== JSON.stringify(defaults);
}

export function profilesEqual(a, b) {
  return JSON.stringify(normalizeProfile(a)) === JSON.stringify(normalizeProfile(b));
}

/** The shape the backend expects (snake_case, exactly the fields it accepts). */
export function buildProfilePayload(profile) {
  const clean = normalizeProfile(profile);

  return {
    explanation_level: clean.explanationLevel,
    explanation_style: clean.explanationStyle,
    language: clean.language,
    quiz_style: clean.quizStyle,
    revision_style: clean.revisionStyle,
    goals: clean.goals,
    interests: clean.interests,
    difficult_topics: clean.difficultTopics.map(({ subject, topic }) => ({ subject, topic }))
  };
}

/**
 * Add the learning profile to an AI request, when there is one to add.
 * Returns the original request untouched when personalisation is off or missing.
 *
 * @param {object} request
 * @param {string} key The request field name (`learningProfile` for chat, `learning_profile` elsewhere).
 * @param {object | null} profilePayload The result of `buildProfilePayload`, or null.
 */
export function attachProfile(request, key, profilePayload) {
  return profilePayload ? { ...request, [key]: profilePayload } : request;
}

/* ------------------------------------------------------- pure list edits */

/**
 * Add one text item to a list. Reports problems in plain words instead of silently dropping input.
 *
 * @returns {{list: string[], error: string | null}}
 */
export function addListItem(list, rawText, { maxItems, maxLength, noun }) {
  const text = cleanText(rawText);

  if (!text) {
    return { list, error: `Type a ${noun} first.` };
  }

  if (text.length > maxLength) {
    return { list, error: `A ${noun} can be at most ${maxLength} characters.` };
  }

  if (list.some((item) => item.toLowerCase() === text.toLowerCase())) {
    return { list, error: `That ${noun} is already in the list.` };
  }

  if (list.length >= maxItems) {
    return { list, error: `You can keep at most ${maxItems} ${noun}s.` };
  }

  return { list: [...list, text], error: null };
}

export const removeListItem = (list, index) => list.filter((_, position) => position !== index);

/** @returns {{list: object[], error: string | null}} */
export function addDifficultTopic(list, { subject, topic: rawTopic }) {
  const topic = cleanText(rawTopic);
  const normalizedSubject = SUBJECTS.includes(subject) ? subject : null;

  if (!topic) {
    return { list, error: 'Type a topic first.' };
  }

  if (topic.length > MAX_TOPIC_LENGTH) {
    return { list, error: `A topic can be at most ${MAX_TOPIC_LENGTH} characters.` };
  }

  if (list.some((item) => item.subject === normalizedSubject && item.topic.toLowerCase() === topic.toLowerCase())) {
    return { list, error: 'That topic is already marked as difficult.' };
  }

  if (list.length >= MAX_DIFFICULT_TOPICS) {
    return { list, error: `You can mark at most ${MAX_DIFFICULT_TOPICS} topics as difficult.` };
  }

  return { list: [...list, { subject: normalizedSubject, topic }], error: null };
}
