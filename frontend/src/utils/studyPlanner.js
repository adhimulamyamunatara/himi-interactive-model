/**
 * Pure helpers for the Study Planner: constants, date maths, validation, response parsing and progress.
 *
 * DATE RULE (mirrors backend/app/utils/study_dates.py):
 *   Study days run from "today" (the student's LOCAL calendar date) up to and including the day
 *   BEFORE the exam. The exam day itself is never a study day. Only the chosen weekdays are used.
 *
 * All dates are plain "YYYY-MM-DD" strings. Day maths goes through Date.UTC so it never depends on
 * the browser time zone or on daylight-saving changes.
 */
import { SUBJECTS } from './subjects.js';

export const WEEKDAYS = [
  { key: 'monday', short: 'Mon', label: 'Monday' },
  { key: 'tuesday', short: 'Tue', label: 'Tuesday' },
  { key: 'wednesday', short: 'Wed', label: 'Wednesday' },
  { key: 'thursday', short: 'Thu', label: 'Thursday' },
  { key: 'friday', short: 'Fri', label: 'Friday' },
  { key: 'saturday', short: 'Sat', label: 'Saturday' },
  { key: 'sunday', short: 'Sun', label: 'Sunday' }
];
export const ALL_WEEKDAY_KEYS = WEEKDAYS.map((day) => day.key);
export const WEEKDAYS_ONLY_KEYS = ALL_WEEKDAY_KEYS.slice(0, 5);

export const CONFIDENCE_LEVELS = [
  { value: 'need_to_start', label: 'Need to start' },
  { value: 'basic', label: 'Basic understanding' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'strong', label: 'Strong understanding' }
];
export const DEFAULT_CONFIDENCE = 'basic';

export const DAILY_MINUTE_OPTIONS = [
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' },
  { value: 240, label: '4 hours' }
];
export const DEFAULT_DAILY_MINUTES = 120;

export const ACTIVITY_LABELS = {
  learn: 'Learn',
  practice: 'Practice',
  revise: 'Revise',
  quiz: 'Quiz',
  mock_test: 'Mock test'
};

export const TASK_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'completed', label: 'Completed' }
];

// These limits mirror backend/app/schemas/study_planner.py.
export const MAX_TITLE_LENGTH = 80;
export const MAX_TOPIC_LENGTH = 60;
export const MAX_TOPICS_PER_SUBJECT = 10;
export const MAX_INSTRUCTIONS_LENGTH = 300;
export const MIN_DAILY_MINUTES = 15;
export const MAX_DAILY_MINUTES = 360;
export const MAX_PLAN_DAYS = 30;
export const CRASH_PLAN_MAX_STUDY_DAYS = 2;

const TEXT_PATTERN = /^[\p{L}\p{N}_\s\-/&,.()+#:'’]+$/u;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;
const PLAN_TYPES = ['standard', 'crash_revision'];

/* ------------------------------------------------------------------ dates */

const pad = (value, length = 2) => String(value).padStart(length, '0');

/** Format a Date using its LOCAL calendar fields (never toISOString, which is UTC). */
export function toLocalDateString(date) {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The student's local calendar date today. `now` can be injected for tests. */
export function getTodayString(now = new Date()) {
  return toLocalDateString(now);
}

/** @returns {{year: number, month: number, day: number} | null} null unless it is a real calendar date. */
export function parseDateString(value) {
  const match = typeof value === 'string' ? DATE_PATTERN.exec(value) : null;

  if (!match) {
    return null;
  }

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  const isReal = check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;

  return isReal ? { year, month, day } : null;
}

export const isValidDateString = (value) => parseDateString(value) !== null;

function toUtcMs(value) {
  const parts = parseDateString(value);
  return parts ? Date.UTC(parts.year, parts.month - 1, parts.day) : Number.NaN;
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). NaN for invalid input. */
export function daysBetween(from, to) {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

export function addDays(value, amount) {
  const date = new Date(toUtcMs(value) + amount * MS_PER_DAY);
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** @returns {string} weekday key such as "monday" (time-zone independent). */
export function getWeekdayKey(value) {
  const sundayFirst = new Date(toUtcMs(value)).getUTCDay();
  return ALL_WEEKDAY_KEYS[(sundayFirst + 6) % 7];
}

const DATE_FORMATTERS = {
  long: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric' }),
  full: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  short: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }),
  weekday: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' })
};

/** Format a "YYYY-MM-DD" string without any time-zone shift. */
export function formatPlanDate(value, style = 'long') {
  return isValidDateString(value) ? DATE_FORMATTERS[style].format(new Date(toUtcMs(value))) : 'Invalid date';
}

/** 45 -> "45 min", 90 -> "1 h 30 min", 120 -> "2 h". */
export function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** All allowed study dates for the rule above, in chronological order. */
export function getStudyDates(startDate, examDate, weekdayKeys = ALL_WEEKDAY_KEYS) {
  if (!isValidDateString(startDate) || !isValidDateString(examDate)) {
    return [];
  }

  const allowed = new Set(weekdayKeys);
  const dates = [];

  for (let current = startDate; daysBetween(current, examDate) > 0; current = addDays(current, 1)) {
    if (allowed.has(getWeekdayKey(current))) {
      dates.push(current);
    }
  }

  return dates;
}

export const getPlanType = (studyDayCount) => (studyDayCount <= CRASH_PLAN_MAX_STUDY_DAYS ? 'crash_revision' : 'standard');

/** Calendar days left until the exam (0 = today, negative = passed). */
export const getDaysUntilExam = (examDate, today) => daysBetween(today, examDate);

/** Short human text such as "12 days to go". */
export function describeDaysUntil(examDate, today) {
  const days = getDaysUntilExam(examDate, today);

  if (Number.isNaN(days)) return '';
  if (days < 0) return days === -1 ? 'Exam was yesterday' : `Exam was ${-days} days ago`;
  if (days === 0) return 'Exam is today';
  if (days === 1) return 'Exam is tomorrow';
  return `${days} days to go`;
}

export const isExamPassed = (examDate, today) => getDaysUntilExam(examDate, today) < 0;

/* ------------------------------------------------------------- validation */

/**
 * Explain why an exam date cannot be planned, or return null when it is fine.
 *
 * @param {string} examDate "YYYY-MM-DD"
 * @param {string} today "YYYY-MM-DD" (local)
 */
export function validateExamDate(examDate, today) {
  if (!examDate) {
    return 'Choose your exam date.';
  }

  if (!isValidDateString(examDate)) {
    return 'Enter a valid date.';
  }

  const days = daysBetween(today, examDate);

  if (days === 0) {
    return 'Your exam is today. A plan covers the days before the exam, so choose a later date. For last-minute revision, try the Quiz Generator.';
  }

  if (days < 0) {
    return 'That exam date has already passed. Choose a date after today.';
  }

  if (days > MAX_PLAN_DAYS) {
    return `Plans cover up to ${MAX_PLAN_DAYS} days. Choose an exam date within the next ${MAX_PLAN_DAYS} days.`;
  }

  return null;
}

/** Split "A, B; C" into clean, unique topic names. */
export function parseTopics(text) {
  const seen = new Set();
  const topics = [];

  for (const part of String(text ?? '').split(/[,;\n]/)) {
    const topic = part.replace(/\s+/g, ' ').trim();

    if (topic && !seen.has(topic.toLowerCase())) {
      seen.add(topic.toLowerCase());
      topics.push(topic);
    }
  }

  return topics;
}

/**
 * @typedef {object} PlanSubjectConfig
 * @property {string} subject
 * @property {string} topics Comma-separated text as typed by the student.
 * @property {string} confidence
 *
 * @typedef {object} PlanConfig
 * @property {string} title
 * @property {string} examDate
 * @property {PlanSubjectConfig[]} subjects
 * @property {number} dailyMinutes
 * @property {string[]} studyDays
 * @property {string} instructions
 */

/** @returns {PlanConfig} */
export function createDefaultConfig() {
  return {
    title: '',
    examDate: '',
    subjects: [],
    dailyMinutes: DEFAULT_DAILY_MINUTES,
    studyDays: [...ALL_WEEKDAY_KEYS],
    instructions: ''
  };
}

/**
 * Validate a plan configuration before it is sent to the backend.
 *
 * @param {PlanConfig} config
 * @param {string} today "YYYY-MM-DD" (local)
 * @returns {Record<string, any>} Field-level messages (`subjectItems` holds per-subject messages). Empty when valid.
 */
export function validateConfig(config, today) {
  const errors = {};
  const title = (config?.title ?? '').trim();

  if (title.length > MAX_TITLE_LENGTH) {
    errors.title = `Keep the title under ${MAX_TITLE_LENGTH} characters.`;
  } else if (title && !TEXT_PATTERN.test(title)) {
    errors.title = 'Use letters, numbers and simple punctuation only.';
  }

  const examDateError = validateExamDate(config?.examDate, today);
  if (examDateError) {
    errors.examDate = examDateError;
  }

  const subjects = Array.isArray(config?.subjects) ? config.subjects : [];

  if (subjects.length === 0) {
    errors.subjects = 'Select at least one subject.';
  } else if (new Set(subjects.map((item) => item.subject)).size !== subjects.length) {
    errors.subjects = 'Each subject can only be selected once.';
  }

  const subjectItems = {};

  for (const item of subjects) {
    const itemErrors = {};

    if (!SUBJECTS.includes(item.subject)) {
      errors.subjects = 'Please choose only the listed subjects.';
    }

    if (!CONFIDENCE_LEVELS.some((level) => level.value === item.confidence)) {
      itemErrors.confidence = 'Choose how confident you feel.';
    }

    const topics = parseTopics(item.topics);

    if (topics.length > MAX_TOPICS_PER_SUBJECT) {
      itemErrors.topics = `Add at most ${MAX_TOPICS_PER_SUBJECT} topics.`;
    } else if (topics.some((topic) => topic.length > MAX_TOPIC_LENGTH)) {
      itemErrors.topics = `Keep each topic under ${MAX_TOPIC_LENGTH} characters.`;
    } else if (topics.some((topic) => !TEXT_PATTERN.test(topic))) {
      itemErrors.topics = 'Use letters, numbers and simple punctuation only.';
    }

    if (Object.keys(itemErrors).length > 0) {
      subjectItems[item.subject] = itemErrors;
    }
  }

  if (Object.keys(subjectItems).length > 0) {
    errors.subjectItems = subjectItems;
  }

  const minutes = config?.dailyMinutes;
  if (!Number.isInteger(minutes) || minutes < MIN_DAILY_MINUTES || minutes > MAX_DAILY_MINUTES) {
    errors.dailyMinutes = 'Choose how long you can study each day.';
  }

  const studyDays = Array.isArray(config?.studyDays) ? config.studyDays : [];

  if (studyDays.length === 0 || studyDays.some((day) => !ALL_WEEKDAY_KEYS.includes(day))) {
    errors.studyDays = 'Select at least one study day.';
  } else if (!errors.examDate && getStudyDates(today, config.examDate, studyDays).length === 0) {
    errors.studyDays = 'None of your selected study days fall before the exam. Add more days or pick a later exam date.';
  }

  if ((config?.instructions ?? '').length > MAX_INSTRUCTIONS_LENGTH) {
    errors.instructions = `Keep this under ${MAX_INSTRUCTIONS_LENGTH} characters.`;
  }

  return errors;
}

/** Request body for POST /api/study-planner/generate. */
export function buildPlanRequest(config, today) {
  const title = config.title.trim().replace(/\s+/g, ' ');
  const instructions = config.instructions.trim().replace(/\s+/g, ' ');

  return {
    ...(title ? { title } : {}),
    exam_date: config.examDate,
    start_date: today,
    subjects: config.subjects.map((item) => ({
      subject: item.subject,
      topics: parseTopics(item.topics),
      confidence: item.confidence
    })),
    daily_available_minutes: config.dailyMinutes,
    preferred_study_days: ALL_WEEKDAY_KEYS.filter((day) => config.studyDays.includes(day)),
    ...(instructions ? { additional_instructions: instructions } : {})
  };
}

/* ----------------------------------------------------- response parsing */

export class InvalidPlanResponseError extends Error {
  constructor(message = 'The study plan response was not in the expected format.') {
    super(message);
    this.name = 'InvalidPlanResponseError';
  }
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;

function fail(message) {
  throw new InvalidPlanResponseError(`Invalid study plan: ${message}`);
}

/**
 * Validate a plan object (from the API or from storage) and return a normalised copy.
 * Totals are recomputed from the tasks instead of trusting the payload.
 *
 * @param {unknown} plan
 * @returns {object}
 * @throws {InvalidPlanResponseError}
 */
export function normalizePlan(plan) {
  if (!isObject(plan)) fail('missing plan.');
  if (!isText(plan.id)) fail('missing id.');
  if (!isText(plan.title)) fail('missing title.');
  if (!isValidDateString(plan.start_date) || !isValidDateString(plan.exam_date)) fail('invalid start or exam date.');
  if (daysBetween(plan.start_date, plan.exam_date) < 1) fail('the exam must be after the start date.');
  if (!PLAN_TYPES.includes(plan.plan_type)) fail('unknown plan type.');

  if (!Array.isArray(plan.subjects) || plan.subjects.length === 0 || plan.subjects.some((name) => !SUBJECTS.includes(name))) {
    fail('invalid subjects.');
  }

  if (!Number.isInteger(plan.daily_available_minutes) || plan.daily_available_minutes < 1) fail('invalid daily minutes.');

  const preferredDays = Array.isArray(plan.preferred_study_days) ? plan.preferred_study_days : ALL_WEEKDAY_KEYS;
  if (preferredDays.length === 0 || preferredDays.some((day) => !ALL_WEEKDAY_KEYS.includes(day))) fail('invalid study days.');

  if (!Array.isArray(plan.schedule) || plan.schedule.length === 0) fail('empty schedule.');

  const taskIds = new Set();
  let previousDate = null;
  let totalMinutes = 0;
  let totalTasks = 0;

  const schedule = plan.schedule.map((day, dayIndex) => {
    if (!isObject(day) || !isValidDateString(day.date)) fail(`day ${dayIndex + 1} has an invalid date.`);
    if (previousDate !== null && daysBetween(previousDate, day.date) < 1) fail('dates are not in chronological order.');
    if (daysBetween(plan.start_date, day.date) < 0 || daysBetween(day.date, plan.exam_date) < 1) {
      fail(`${day.date} is outside the study window.`);
    }
    if (!preferredDays.includes(getWeekdayKey(day.date))) fail(`${day.date} is not one of the chosen study days.`);
    if (!isText(day.focus)) fail(`${day.date} has no focus.`);
    if (!Array.isArray(day.tasks) || day.tasks.length === 0) fail(`${day.date} has no tasks.`);

    previousDate = day.date;
    let dayMinutes = 0;

    const tasks = day.tasks.map((task) => {
      if (!isObject(task) || !isText(task.id) || taskIds.has(task.id)) fail('a task has a missing or duplicate id.');
      if (!plan.subjects.includes(task.subject)) fail('a task uses a subject that was not selected.');
      if (!isText(task.title) || !isText(task.description)) fail('a task is missing its title or description.');
      if (!Object.hasOwn(ACTIVITY_LABELS, task.activity_type)) fail('a task has an unknown activity type.');
      if (!Number.isInteger(task.duration_minutes) || task.duration_minutes < 1 || task.duration_minutes > plan.daily_available_minutes) {
        fail('a task has an invalid duration.');
      }

      taskIds.add(task.id);
      dayMinutes += task.duration_minutes;

      return {
        id: task.id,
        subject: task.subject,
        title: task.title.trim(),
        description: task.description.trim(),
        duration_minutes: task.duration_minutes,
        activity_type: task.activity_type,
        completed: task.completed === true
      };
    });

    if (dayMinutes > plan.daily_available_minutes) fail(`${day.date} exceeds the daily time limit.`);

    totalMinutes += dayMinutes;
    totalTasks += tasks.length;

    return { date: day.date, focus: day.focus.trim(), total_minutes: dayMinutes, tasks };
  });

  const stringList = (value) => (Array.isArray(value) ? value.filter(isText).map((item) => item.trim()) : []);

  return {
    id: plan.id,
    title: plan.title.trim(),
    exam_date: plan.exam_date,
    start_date: plan.start_date,
    plan_type: plan.plan_type,
    subjects: [...plan.subjects],
    daily_available_minutes: plan.daily_available_minutes,
    preferred_study_days: [...preferredDays],
    total_planned_minutes: totalMinutes,
    total_tasks: totalTasks,
    suggested_topic_subjects: stringList(plan.suggested_topic_subjects).filter((name) => plan.subjects.includes(name)),
    notes: stringList(plan.notes).slice(0, 5),
    schedule
  };
}

/** Validate the full API response body `{status, plan}` and return the normalised plan. */
export function parsePlanResponse(data) {
  if (!isObject(data) || data.status !== 'success') {
    throw new InvalidPlanResponseError();
  }

  return normalizePlan(data.plan);
}

/* --------------------------------------------------------------- progress */

export const getAllTasks = (plan) => plan.schedule.flatMap((day) => day.tasks);

const toPercentage = (completed, total) => (total === 0 ? 0 : (completed / total) * 100);

/** Overall progress from the real completion flags. */
export function calculateProgress(plan) {
  const tasks = getAllTasks(plan);
  const done = tasks.filter((task) => task.completed);

  return {
    totalTasks: tasks.length,
    completedTasks: done.length,
    remainingTasks: tasks.length - done.length,
    percentage: toPercentage(done.length, tasks.length),
    totalMinutes: tasks.reduce((sum, task) => sum + task.duration_minutes, 0),
    completedMinutes: done.reduce((sum, task) => sum + task.duration_minutes, 0)
  };
}

/** Progress per subject, in the order the subjects appear in the plan. */
export function calculateSubjectProgress(plan) {
  const tasks = getAllTasks(plan);

  return plan.subjects.map((subject) => {
    const own = tasks.filter((task) => task.subject === subject);
    const done = own.filter((task) => task.completed);

    return {
      subject,
      totalTasks: own.length,
      completedTasks: done.length,
      remainingTasks: own.length - done.length,
      percentage: toPercentage(done.length, own.length),
      totalMinutes: own.reduce((sum, task) => sum + task.duration_minutes, 0),
      completedMinutes: done.reduce((sum, task) => sum + task.duration_minutes, 0)
    };
  });
}

export function calculateDayStats(day) {
  const done = day.tasks.filter((task) => task.completed);

  return {
    totalTasks: day.tasks.length,
    completedTasks: done.length,
    totalMinutes: day.tasks.reduce((sum, task) => sum + task.duration_minutes, 0),
    isComplete: day.tasks.length > 0 && done.length === day.tasks.length
  };
}

/** @param {'all' | 'incomplete' | 'completed'} filter */
export function filterTasks(tasks, filter) {
  if (filter === 'incomplete') return tasks.filter((task) => !task.completed);
  if (filter === 'completed') return tasks.filter((task) => task.completed);
  return tasks;
}

/**
 * Days with their tasks filtered. With a filter other than "all", days left with no tasks are dropped.
 *
 * @returns {Array<{day: object, tasks: object[]}>}
 */
export function filterSchedule(plan, filter) {
  return plan.schedule
    .map((day) => ({ day, tasks: filterTasks(day.tasks, filter) }))
    .filter((entry) => filter === 'all' || entry.tasks.length > 0);
}

/** Count of tasks matching each filter, for the filter labels. */
export function countByFilter(plan) {
  const { totalTasks, completedTasks, remainingTasks } = calculateProgress(plan);
  return { all: totalTasks, incomplete: remainingTasks, completed: completedTasks };
}

/**
 * Return a copy of the plan with one task's completion changed. Other plans, days and tasks are
 * untouched (and keep their object identity). Returns the same plan when nothing changes.
 */
export function setTaskCompleted(plan, taskId, completed) {
  let changed = false;

  const schedule = plan.schedule.map((day) => {
    if (!day.tasks.some((task) => task.id === taskId && task.completed !== completed)) {
      return day;
    }

    changed = true;
    return { ...day, tasks: day.tasks.map((task) => (task.id === taskId ? { ...task, completed } : task)) };
  });

  return changed ? { ...plan, schedule } : plan;
}

/** The date a student should look at first: today's tasks, else the next day with unfinished work. */
export function getFocusDate(plan, today) {
  const pending = plan.schedule.filter((day) => day.tasks.some((task) => !task.completed));
  const upcoming = pending.find((day) => daysBetween(today, day.date) >= 0);

  return (upcoming ?? pending[0] ?? plan.schedule[0]).date;
}
