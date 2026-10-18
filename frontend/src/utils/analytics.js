/**
 * Pure aggregation for the progress page.
 *
 * Everything is computed from real data: quiz attempts the student finished, and the study plans' own task flags.
 * Nothing is estimated. When there is no data the result says so (`null` / empty lists) instead of inventing numbers.
 */
import { SUBJECTS } from './subjects.js';
import { addDays, isValidDateString, toLocalDateString } from './studyPlanner.js';

export const DATE_PRESETS = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' }
];

export const REVISION_THRESHOLD = 60; // average score (%) below which a topic is suggested for revision
export const REVISION_WINDOW = 3; // how many of the most recent attempts per topic are averaged
export const TREND_POINTS = 12;
export const RECENT_WINDOW = 5;

const average = (values) => (values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length);
const toPercentage = (done, total) => (total === 0 ? null : (done / total) * 100);

/* ------------------------------------------------------------------ dates */

/** The student's local calendar date of an attempt. */
export const attemptDate = (attempt) => toLocalDateString(new Date(attempt.submittedAt));

/**
 * Turn the filter chosen on screen into an inclusive local-date range.
 *
 * @param {{preset: string, from?: string, to?: string}} filter
 * @param {string} today "YYYY-MM-DD" (student's local date)
 * @returns {{range: {from: string, to: string} | null, error: string | null}} `range: null` means "all time".
 */
export function resolveRange(filter, today) {
  switch (filter?.preset) {
    case '7d':
      return { range: { from: addDays(today, -6), to: today }, error: null };
    case '30d':
      return { range: { from: addDays(today, -29), to: today }, error: null };
    case 'custom': {
      if (!isValidDateString(filter.from) || !isValidDateString(filter.to)) {
        return { range: null, error: 'Choose both a start date and an end date.' };
      }

      if (filter.from > filter.to) {
        return { range: null, error: 'The start date must be on or before the end date.' };
      }

      return { range: { from: filter.from, to: filter.to }, error: null };
    }
    default:
      return { range: null, error: null };
  }
}

const inRange = (date, range) => range === null || (date >= range.from && date <= range.to);

/* ------------------------------------------------------------------ quizzes */

/** One entry per attempt id (the first one wins), oldest first. */
export function prepareAttempts(attempts) {
  const seen = new Set();
  const unique = [];

  for (const attempt of attempts) {
    if (!seen.has(attempt.id)) {
      seen.add(attempt.id);
      unique.push(attempt);
    }
  }

  return unique.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.id.localeCompare(b.id));
}

export function filterAttempts(attempts, range) {
  return prepareAttempts(attempts).filter((attempt) => inRange(attemptDate(attempt), range));
}

export function summarizeQuizzes(attempts) {
  const ordered = prepareAttempts(attempts);
  const scores = ordered.map((attempt) => attempt.percentage);

  return {
    count: ordered.length,
    averageScore: average(scores),
    recentAverage: average(scores.slice(-RECENT_WINDOW)),
    bestScore: scores.length === 0 ? null : Math.max(...scores),
    latest: ordered.at(-1) ?? null,
    totalQuestions: ordered.reduce((sum, attempt) => sum + attempt.total, 0),
    totalCorrect: ordered.reduce((sum, attempt) => sum + attempt.correct, 0)
  };
}

/** The most recent attempts in time order, ready for a chart. */
export function scoreTrend(attempts, limit = TREND_POINTS) {
  return prepareAttempts(attempts)
    .slice(-limit)
    .map((attempt) => ({
      id: attempt.id,
      date: attemptDate(attempt),
      subject: attempt.subject,
      topic: attempt.topic,
      percentage: attempt.percentage
    }));
}

/** Average score per subject, only for subjects that have attempts, in the app's subject order. */
export function subjectScores(attempts) {
  const ordered = prepareAttempts(attempts);

  return SUBJECTS.flatMap((subject) => {
    const own = ordered.filter((attempt) => attempt.subject === subject);

    return own.length === 0
      ? []
      : [{ subject, attempts: own.length, averageScore: average(own.map((attempt) => attempt.percentage)), latestScore: own.at(-1).percentage }];
  });
}

/**
 * Topics (as typed by the student when generating quizzes) and subjects that need revision.
 * A group is flagged when the average of its most recent attempts is below the threshold.
 * Quizzes without a topic are grouped per subject as a whole.
 */
export function topicsNeedingRevision(attempts, { threshold = REVISION_THRESHOLD, window = REVISION_WINDOW } = {}) {
  const groups = new Map();

  for (const attempt of prepareAttempts(attempts)) {
    const key = `${attempt.subject}|${(attempt.topic ?? '').toLowerCase()}`;
    const group = groups.get(key) ?? { subject: attempt.subject, topic: attempt.topic, attempts: [] };
    group.attempts.push(attempt);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => {
      const recent = group.attempts.slice(-window);

      return {
        subject: group.subject,
        topic: group.topic,
        attemptsUsed: recent.length,
        averageScore: average(recent.map((attempt) => attempt.percentage)),
        lastAttemptDate: attemptDate(recent.at(-1))
      };
    })
    .filter((item) => item.averageScore < threshold)
    .sort((a, b) => a.averageScore - b.averageScore || b.attemptsUsed - a.attemptsUsed || a.subject.localeCompare(b.subject));
}

/* ------------------------------------------------------------------- plans */

/**
 * Task completion from the saved study plans (the planner's own data, read only).
 * Completion times are not recorded, so a date range selects tasks by the day they are scheduled for.
 *
 * @param {Array<{id: string, title: string, plan: object}>} records
 */
export function summarizePlans(records, range) {
  const perPlan = [];
  const subjectTotals = new Map();
  let total = 0;
  let completed = 0;

  for (const record of records) {
    const tasks = record.plan.schedule
      .filter((day) => inRange(day.date, range))
      .flatMap((day) => day.tasks);

    if (tasks.length === 0) {
      continue;
    }

    const done = tasks.filter((task) => task.completed).length;
    total += tasks.length;
    completed += done;
    perPlan.push({
      id: record.id,
      title: record.title,
      examDate: record.plan.exam_date,
      total: tasks.length,
      completed: done,
      percentage: toPercentage(done, tasks.length)
    });

    for (const task of tasks) {
      const entry = subjectTotals.get(task.subject) ?? { total: 0, completed: 0 };
      entry.total += 1;
      entry.completed += task.completed ? 1 : 0;
      subjectTotals.set(task.subject, entry);
    }
  }

  const bySubject = SUBJECTS.flatMap((subject) => {
    const entry = subjectTotals.get(subject);

    return entry
      ? [{ subject, total: entry.total, completed: entry.completed, remaining: entry.total - entry.completed, percentage: toPercentage(entry.completed, entry.total) }]
      : [];
  });

  return {
    planCount: perPlan.length,
    totalTasks: total,
    completedTasks: completed,
    remainingTasks: total - completed,
    percentage: toPercentage(completed, total),
    bySubject,
    perPlan
  };
}

/* ---------------------------------------------------------------- combined */

/**
 * @param {{attempts: object[], plans: object[], range: {from: string, to: string} | null}} input
 */
export function buildAnalytics({ attempts, plans, range }) {
  const inScope = filterAttempts(attempts, range);

  return {
    quiz: summarizeQuizzes(inScope),
    trend: scoreTrend(inScope),
    subjects: subjectScores(inScope),
    revision: topicsNeedingRevision(inScope),
    plans: summarizePlans(plans, range),
    hasAnyQuizData: prepareAttempts(attempts).length > 0,
    hasAnyPlanData: plans.length > 0
  };
}
