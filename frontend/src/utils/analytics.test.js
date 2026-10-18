import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  REVISION_THRESHOLD,
  attemptDate,
  buildAnalytics,
  filterAttempts,
  prepareAttempts,
  resolveRange,
  scoreTrend,
  subjectScores,
  summarizePlans,
  summarizeQuizzes,
  topicsNeedingRevision
} from './analytics.js';
import { calculateProgress, calculateSubjectProgress, normalizePlan } from './studyPlanner.js';

let counter = 0;
const attempt = (extra = {}) => {
  counter += 1;
  const correct = extra.correct ?? 3;
  const total = extra.total ?? 5;
  return {
    id: extra.id ?? `a${counter}`,
    submittedAt: extra.submittedAt ?? `2026-10-${String(10 + (counter % 15)).padStart(2, '0')}T12:00:00`,
    subject: 'DBMS',
    topic: null,
    difficulty: 'Medium',
    total,
    correct,
    unanswered: 0,
    percentage: (correct / total) * 100,
    ...extra
  };
};
const at = (day, extra = {}) => attempt({ submittedAt: `2026-10-${String(day).padStart(2, '0')}T12:00:00`, ...extra });

describe('date ranges', () => {
  it('resolves presets relative to the student date', () => {
    assert.deepEqual(resolveRange({ preset: 'all' }, '2026-10-18'), { range: null, error: null });
    assert.deepEqual(resolveRange({ preset: '7d' }, '2026-10-18').range, { from: '2026-10-12', to: '2026-10-18' });
    assert.deepEqual(resolveRange({ preset: '30d' }, '2026-10-18').range, { from: '2026-09-19', to: '2026-10-18' });
  });

  it('validates a custom range', () => {
    assert.deepEqual(resolveRange({ preset: 'custom', from: '2026-10-01', to: '2026-10-05' }, '2026-10-18').range, {
      from: '2026-10-01',
      to: '2026-10-05'
    });
    assert.deepEqual(resolveRange({ preset: 'custom', from: '2026-10-01', to: '2026-10-01' }, 'x').range, { from: '2026-10-01', to: '2026-10-01' });
    assert.match(resolveRange({ preset: 'custom', from: '2026-10-05', to: '2026-10-01' }, 'x').error, /on or before/);
    assert.match(resolveRange({ preset: 'custom', from: '', to: '2026-10-01' }, 'x').error, /both/);
    assert.match(resolveRange({ preset: 'custom', from: '2026-13-45', to: '2026-10-01' }, 'x').error, /both/);
  });

  it('filters attempts inclusively by local date', () => {
    const list = [at(9), at(10), at(15), at(16)];
    const filtered = filterAttempts(list, { from: '2026-10-10', to: '2026-10-15' });
    assert.deepEqual(filtered.map(attemptDate), ['2026-10-10', '2026-10-15']);
    assert.equal(filterAttempts(list, null).length, 4);
    assert.equal(filterAttempts(list, { from: '2027-01-01', to: '2027-01-02' }).length, 0);
  });
});

describe('quiz statistics', () => {
  it('reports honest empty values when there are no attempts', () => {
    const summary = summarizeQuizzes([]);
    assert.equal(summary.count, 0);
    assert.equal(summary.averageScore, null);
    assert.equal(summary.recentAverage, null);
    assert.equal(summary.bestScore, null);
    assert.equal(summary.latest, null);
    assert.deepEqual(scoreTrend([]), []);
    assert.deepEqual(subjectScores([]), []);
    assert.deepEqual(topicsNeedingRevision([]), []);
  });

  it('computes average, best, latest and totals from real scores', () => {
    const summary = summarizeQuizzes([at(10, { correct: 5 }), at(11, { correct: 3 }), at(12, { correct: 4 })]);
    assert.equal(summary.count, 3);
    assert.equal(summary.averageScore, 80); // (100 + 60 + 80) / 3
    assert.equal(summary.bestScore, 100);
    assert.equal(summary.latest.percentage, 80);
    assert.equal(summary.totalQuestions, 15);
    assert.equal(summary.totalCorrect, 12);
  });

  it('recent average uses only the latest five attempts', () => {
    const list = [at(1, { correct: 0 }), ...[10, 11, 12, 13, 14].map((day) => at(day, { correct: 5 }))];
    assert.equal(summarizeQuizzes(list).recentAverage, 100);
    assert.equal(Math.round(summarizeQuizzes(list).averageScore), 83);
  });

  it('handles perfect, zero and unanswered scores', () => {
    assert.equal(summarizeQuizzes([at(1, { correct: 0, unanswered: 5 })]).averageScore, 0);
    assert.equal(summarizeQuizzes([at(1, { correct: 5 })]).averageScore, 100);
  });

  it('never counts the same attempt id twice', () => {
    const duplicated = [at(10, { id: 'same', correct: 5 }), at(11, { id: 'same', correct: 0 })];
    assert.equal(prepareAttempts(duplicated).length, 1);
    assert.equal(summarizeQuizzes(duplicated).count, 1);
    assert.equal(summarizeQuizzes(duplicated).averageScore, 100);
  });

  it('orders attempts by time regardless of input order', () => {
    const list = [at(12, { id: 'c' }), at(10, { id: 'a' }), at(11, { id: 'b' })];
    assert.deepEqual(prepareAttempts(list).map((item) => item.id), ['a', 'b', 'c']);
    assert.equal(summarizeQuizzes(list).latest.id, 'c');
  });

  it('builds a time-ordered trend limited to the most recent attempts', () => {
    const list = Array.from({ length: 20 }, (_, index) => at(index + 1, { id: `t${index}` }));
    const trend = scoreTrend(list, 12);
    assert.equal(trend.length, 12);
    assert.equal(trend[0].id, 't8');
    assert.equal(trend.at(-1).id, 't19');
  });

  it('averages scores per subject, in subject order, only for subjects with data', () => {
    const list = [at(10, { subject: 'Python', correct: 5 }), at(11, { subject: 'DBMS', correct: 2 }), at(12, { subject: 'DBMS', correct: 4 })];
    const rows = subjectScores(list);
    assert.deepEqual(rows.map((row) => row.subject), ['DBMS', 'Python']);
    assert.equal(rows[0].averageScore, 60);
    assert.equal(rows[0].attempts, 2);
    assert.equal(rows[0].latestScore, 80);
  });
});

describe('topics needing revision', () => {
  it('flags only groups whose recent average is below the threshold', () => {
    const list = [
      at(10, { topic: 'Normalization', correct: 1 }),
      at(11, { topic: 'Transactions', correct: 5 }),
      at(12, { topic: 'normalization', correct: 2 })
    ];
    const result = topicsNeedingRevision(list);
    assert.equal(result.length, 1);
    assert.equal(result[0].topic, 'Normalization');
    assert.equal(result[0].averageScore, 30);
    assert.equal(result[0].attemptsUsed, 2);
    assert.ok(result[0].averageScore < REVISION_THRESHOLD);
  });

  it('uses only the latest attempts, so improvement clears a topic', () => {
    const list = [
      at(1, { topic: 'Joins', correct: 0 }),
      at(2, { topic: 'Joins', correct: 0 }),
      at(10, { topic: 'Joins', correct: 5 }),
      at(11, { topic: 'Joins', correct: 5 }),
      at(12, { topic: 'Joins', correct: 5 })
    ];
    assert.deepEqual(topicsNeedingRevision(list), []);
  });

  it('a score exactly at the threshold is not flagged', () => {
    assert.deepEqual(topicsNeedingRevision([at(1, { topic: 'X', correct: 3 })]), []);
    assert.equal(topicsNeedingRevision([at(1, { topic: 'X', correct: 2 })]).length, 1);
  });

  it('groups topic-less quizzes per subject and keeps subjects apart', () => {
    const list = [at(1, { correct: 0 }), at(2, { subject: 'Java', correct: 0 })];
    const result = topicsNeedingRevision(list);
    assert.deepEqual(result.map((item) => [item.subject, item.topic]), [['DBMS', null], ['Java', null]]);
  });

  it('lists the weakest first', () => {
    const list = [at(1, { topic: 'A', correct: 2 }), at(2, { topic: 'B', correct: 0 })];
    assert.deepEqual(topicsNeedingRevision(list).map((item) => item.topic), ['B', 'A']);
  });
});

const makePlan = (id, completedFlags, { startDate = '2026-10-10', examDate = '2026-10-20', subjects = ['DBMS', 'Python'] } = {}) =>
  normalizePlan({
    id,
    title: `Plan ${id}`,
    start_date: startDate,
    exam_date: examDate,
    plan_type: 'standard',
    subjects,
    daily_available_minutes: 120,
    preferred_study_days: null,
    schedule: completedFlags.map((flags, dayIndex) => ({
      date: `2026-10-${String(11 + dayIndex).padStart(2, '0')}`,
      focus: 'Focus',
      tasks: flags.map((completed, taskIndex) => ({
        id: `${id}-d${dayIndex}-t${taskIndex}`,
        subject: subjects[taskIndex % subjects.length],
        title: 'Task',
        description: 'Do this task carefully.',
        duration_minutes: 30,
        activity_type: 'learn',
        completed
      }))
    }))
  });
const record = (plan) => ({ id: plan.id, title: plan.title, plan });

describe('study plan progress', () => {
  it('matches the planner\'s own totals (no second source of truth)', () => {
    const plan = makePlan('p1', [[true, false], [true, true], [false, false]]);
    const summary = summarizePlans([record(plan)], null);
    const own = calculateProgress(plan);
    assert.equal(summary.totalTasks, own.totalTasks);
    assert.equal(summary.completedTasks, own.completedTasks);
    assert.equal(summary.remainingTasks, own.remainingTasks);
    assert.equal(summary.percentage, own.percentage);
    const ownBySubject = calculateSubjectProgress(plan);
    for (const row of summary.bySubject) {
      const match = ownBySubject.find((item) => item.subject === row.subject);
      assert.equal(row.completed, match.completedTasks);
      assert.equal(row.total, match.totalTasks);
    }
  });

  it('adds up several plans without double counting', () => {
    const a = makePlan('a', [[true, true]]);
    const b = makePlan('b', [[true, false]]);
    const summary = summarizePlans([record(a), record(b)], null);
    assert.equal(summary.planCount, 2);
    assert.equal(summary.totalTasks, 4);
    assert.equal(summary.completedTasks, 3);
    assert.equal(summary.perPlan.length, 2);
  });

  it('has no percentage when there are no tasks', () => {
    const summary = summarizePlans([], null);
    assert.equal(summary.percentage, null);
    assert.equal(summary.planCount, 0);
    assert.deepEqual(summary.bySubject, []);
  });

  it('selects tasks by scheduled date when a range is given', () => {
    const plan = makePlan('p', [[true], [false], [true]]); // 11th, 12th, 13th
    const summary = summarizePlans([record(plan)], { from: '2026-10-12', to: '2026-10-13' });
    assert.equal(summary.totalTasks, 2);
    assert.equal(summary.completedTasks, 1);
    assert.equal(summarizePlans([record(plan)], { from: '2026-12-01', to: '2026-12-02' }).planCount, 0);
  });
});

describe('buildAnalytics', () => {
  it('is entirely empty for a brand new student', () => {
    const result = buildAnalytics({ attempts: [], plans: [], range: null });
    assert.equal(result.hasAnyQuizData, false);
    assert.equal(result.hasAnyPlanData, false);
    assert.equal(result.quiz.count, 0);
    assert.equal(result.plans.percentage, null);
  });

  it('applies the date range to quizzes and plans together', () => {
    const attempts = [at(5, { correct: 0 }), at(15, { correct: 5 })];
    const plan = makePlan('p', [[true], [false]]);
    const result = buildAnalytics({ attempts, plans: [record(plan)], range: { from: '2026-10-14', to: '2026-10-16' } });
    assert.equal(result.quiz.count, 1);
    assert.equal(result.quiz.averageScore, 100);
    assert.equal(result.hasAnyQuizData, true);
    assert.equal(result.plans.totalTasks, 0); // the plan's days (11th, 12th) are outside the range
    assert.equal(result.hasAnyPlanData, true);
  });
});
