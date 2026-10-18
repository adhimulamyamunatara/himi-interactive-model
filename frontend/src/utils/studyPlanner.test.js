// Run with: npm test  (Node's built-in runner). Try `TZ=Pacific/Kiritimati npm test` to prove time-zone independence.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ALL_WEEKDAY_KEYS,
  MAX_PLAN_DAYS,
  InvalidPlanResponseError,
  addDays,
  buildPlanRequest,
  calculateDayStats,
  calculateProgress,
  calculateSubjectProgress,
  countByFilter,
  createDefaultConfig,
  daysBetween,
  describeDaysUntil,
  filterSchedule,
  filterTasks,
  formatMinutes,
  formatPlanDate,
  getFocusDate,
  getPlanType,
  getStudyDates,
  getTodayString,
  getWeekdayKey,
  isExamPassed,
  isValidDateString,
  normalizePlan,
  parsePlanResponse,
  parseTopics,
  setTaskCompleted,
  toLocalDateString,
  validateConfig,
  validateExamDate
} from './studyPlanner.js';

const TODAY = '2026-10-18'; // a Sunday

const task = (id, subject, overrides = {}) => ({
  id,
  subject,
  title: `Task ${id}`,
  description: `Do the work for ${id} carefully.`,
  duration_minutes: 45,
  activity_type: 'learn',
  completed: false,
  ...overrides
});

const makePlan = (overrides = {}) => ({
  id: 'plan-1',
  title: 'Semester prep',
  exam_date: '2026-10-22',
  start_date: TODAY,
  plan_type: 'standard',
  subjects: ['DBMS', 'Operating Systems'],
  daily_available_minutes: 120,
  preferred_study_days: [...ALL_WEEKDAY_KEYS],
  total_planned_minutes: 0,
  total_tasks: 0,
  suggested_topic_subjects: ['Operating Systems'],
  notes: ['Take breaks.'],
  schedule: [
    { date: '2026-10-18', focus: 'Basics', total_minutes: 90, tasks: [task('task-1', 'DBMS'), task('task-2', 'Operating Systems')] },
    { date: '2026-10-19', focus: 'Practice', total_minutes: 90, tasks: [task('task-3', 'DBMS', { activity_type: 'practice' }), task('task-4', 'DBMS')] },
    { date: '2026-10-20', focus: 'Revision', total_minutes: 45, tasks: [task('task-5', 'Operating Systems', { activity_type: 'revise' })] }
  ],
  ...overrides
});

const validConfig = (overrides = {}) => ({
  ...createDefaultConfig(),
  title: 'Mid-sem prep',
  examDate: '2026-10-25',
  subjects: [
    { subject: 'DBMS', topics: 'Normalization, Transactions', confidence: 'basic' },
    { subject: 'Operating Systems', topics: '', confidence: 'need_to_start' }
  ],
  ...overrides
});

describe('local date handling', () => {
  it('formats a Date using local calendar fields, never UTC', () => {
    assert.equal(toLocalDateString(new Date(2026, 11, 31, 23, 59, 59)), '2026-12-31');
    assert.equal(toLocalDateString(new Date(2026, 0, 1, 0, 0, 1)), '2026-01-01');
    assert.equal(getTodayString(new Date(2028, 1, 29, 12)), '2028-02-29');
  });

  it('validates real calendar dates only (leap years included)', () => {
    assert.equal(isValidDateString('2028-02-29'), true);
    assert.equal(isValidDateString('2027-02-29'), false);
    assert.equal(isValidDateString('2100-02-29'), false); // not a leap year
    assert.equal(isValidDateString('2000-02-29'), true);
    assert.equal(isValidDateString('2026-13-01'), false);
    assert.equal(isValidDateString('2026-04-31'), false);
    assert.equal(isValidDateString('2026-4-1'), false);
    assert.equal(isValidDateString(''), false);
    assert.equal(isValidDateString(null), false);
  });

  it('counts calendar days across month, year and leap boundaries', () => {
    assert.equal(daysBetween('2026-10-18', '2026-10-18'), 0);
    assert.equal(daysBetween('2026-10-18', '2026-10-19'), 1);
    assert.equal(daysBetween('2026-10-18', '2026-10-17'), -1);
    assert.equal(daysBetween('2026-01-31', '2026-03-01'), 29);
    assert.equal(daysBetween('2028-01-31', '2028-03-01'), 30); // leap year
    assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
    assert.equal(daysBetween('2026-12-25', '2027-01-05'), 11);
    assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2); // a DST changeover week in many zones
    assert.ok(Number.isNaN(daysBetween('nope', '2026-10-18')));
  });

  it('adds days and finds weekdays without time-zone drift', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2028-02-28', 1), '2028-02-29');
    assert.equal(addDays('2027-02-28', 1), '2027-03-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
    assert.equal(getWeekdayKey('2026-10-18'), 'sunday');
    assert.equal(getWeekdayKey('2026-10-19'), 'monday');
    assert.equal(getWeekdayKey('2028-02-29'), 'tuesday');
  });

  it('formats dates without shifting the day', () => {
    assert.equal(formatPlanDate('2026-10-18'), 'Sunday, Oct 18');
    assert.equal(formatPlanDate('2026-01-01', 'short'), 'Jan 1, 2026');
    assert.equal(formatPlanDate('2026-12-31', 'weekday'), 'Thursday');
    assert.equal(formatPlanDate('garbage'), 'Invalid date');
  });

  it('formats minutes for display', () => {
    assert.equal(formatMinutes(30), '30 min');
    assert.equal(formatMinutes(60), '1 h');
    assert.equal(formatMinutes(90), '1 h 30 min');
    assert.equal(formatMinutes(240), '4 h');
  });

  it('describes the time left', () => {
    assert.equal(describeDaysUntil('2026-10-18', TODAY), 'Exam is today');
    assert.equal(describeDaysUntil('2026-10-19', TODAY), 'Exam is tomorrow');
    assert.equal(describeDaysUntil('2026-10-30', TODAY), '12 days to go');
    assert.equal(describeDaysUntil('2026-10-17', TODAY), 'Exam was yesterday');
    assert.equal(describeDaysUntil('2026-10-10', TODAY), 'Exam was 8 days ago');
    assert.equal(isExamPassed('2026-10-17', TODAY), true);
    assert.equal(isExamPassed('2026-10-18', TODAY), false);
  });
});

describe('study date rule', () => {
  it('runs from today to the day BEFORE the exam', () => {
    assert.deepEqual(getStudyDates('2026-10-18', '2026-10-21'), ['2026-10-18', '2026-10-19', '2026-10-20']);
    assert.deepEqual(getStudyDates('2026-10-18', '2026-10-19'), ['2026-10-18']); // exam tomorrow
  });

  it('has no study days when the exam is today or past', () => {
    assert.deepEqual(getStudyDates('2026-10-18', '2026-10-18'), []);
    assert.deepEqual(getStudyDates('2026-10-18', '2026-10-10'), []);
    assert.deepEqual(getStudyDates('bad', '2026-10-10'), []);
  });

  it('only uses the chosen weekdays', () => {
    const dates = getStudyDates('2026-10-18', '2026-11-01', ['monday', 'thursday']);
    assert.deepEqual(dates, ['2026-10-19', '2026-10-22', '2026-10-26', '2026-10-29']);
    assert.deepEqual(getStudyDates('2026-10-18', '2026-10-19', ['monday']), []);
  });

  it('crosses month, year and leap boundaries', () => {
    assert.equal(getStudyDates('2026-12-29', '2027-01-03').length, 5);
    assert.deepEqual(getStudyDates('2028-02-28', '2028-03-01'), ['2028-02-28', '2028-02-29']);
    assert.deepEqual(getStudyDates('2027-02-28', '2027-03-01'), ['2027-02-28']);
  });

  it('labels plans with two or fewer study days as crash revision', () => {
    assert.equal(getPlanType(1), 'crash_revision');
    assert.equal(getPlanType(2), 'crash_revision');
    assert.equal(getPlanType(3), 'standard');
  });
});

describe('validateExamDate', () => {
  it('explains each unusable date', () => {
    assert.match(validateExamDate('', TODAY), /Choose your exam date/);
    assert.match(validateExamDate('2026-02-30', TODAY), /valid date/);
    assert.match(validateExamDate(TODAY, TODAY), /exam is today/);
    assert.match(validateExamDate('2026-10-17', TODAY), /already passed/);
    assert.match(validateExamDate('2025-01-01', TODAY), /already passed/);
    assert.match(validateExamDate(addDays(TODAY, MAX_PLAN_DAYS + 1), TODAY), /up to 30 days/);
  });

  it('accepts tomorrow through the maximum window', () => {
    assert.equal(validateExamDate('2026-10-19', TODAY), null);
    assert.equal(validateExamDate(addDays(TODAY, MAX_PLAN_DAYS), TODAY), null);
  });
});

describe('plan configuration', () => {
  it('starts with sensible defaults', () => {
    const config = createDefaultConfig();
    assert.deepEqual(config.subjects, []);
    assert.equal(config.dailyMinutes, 120);
    assert.deepEqual(config.studyDays, ALL_WEEKDAY_KEYS);
  });

  it('parses topics from commas, semicolons and new lines', () => {
    assert.deepEqual(parseTopics(' A,  B ;C\nD, a ,, '), ['A', 'B', 'C', 'D']);
    assert.deepEqual(parseTopics(''), []);
    assert.deepEqual(parseTopics(undefined), []);
  });

  it('accepts a complete, valid configuration', () => {
    assert.deepEqual(validateConfig(validConfig(), TODAY), {});
  });

  it('requires at least one subject', () => {
    assert.match(validateConfig(validConfig({ subjects: [] }), TODAY).subjects, /at least one subject/);
  });

  it('rejects duplicate and unknown subjects', () => {
    const dup = [
      { subject: 'DBMS', topics: '', confidence: 'basic' },
      { subject: 'DBMS', topics: '', confidence: 'basic' }
    ];
    assert.ok(validateConfig(validConfig({ subjects: dup }), TODAY).subjects);
    assert.ok(validateConfig(validConfig({ subjects: [{ subject: 'Astrology', topics: '', confidence: 'basic' }] }), TODAY).subjects);
  });

  it('validates per-subject topics and confidence', () => {
    const errors = validateConfig(
      validConfig({
        subjects: [
          { subject: 'DBMS', topics: 'x'.repeat(61), confidence: 'basic' },
          { subject: 'Java', topics: Array.from({ length: 11 }, (_, i) => `T${i}`).join(','), confidence: 'basic' },
          { subject: 'Python', topics: '{{x}}', confidence: 'basic' },
          { subject: 'Algorithms', topics: '', confidence: 'expert' }
        ]
      }),
      TODAY
    );
    assert.match(errors.subjectItems.DBMS.topics, /under 60/);
    assert.match(errors.subjectItems.Java.topics, /at most 10/);
    assert.match(errors.subjectItems.Python.topics, /simple punctuation/);
    assert.ok(errors.subjectItems.Algorithms.confidence);
  });

  it('validates the exam date, time, days and text lengths', () => {
    assert.ok(validateConfig(validConfig({ examDate: TODAY }), TODAY).examDate);
    assert.ok(validateConfig(validConfig({ examDate: '2026-10-01' }), TODAY).examDate);
    assert.ok(validateConfig(validConfig({ dailyMinutes: 0 }), TODAY).dailyMinutes);
    assert.ok(validateConfig(validConfig({ dailyMinutes: 1000 }), TODAY).dailyMinutes);
    assert.ok(validateConfig(validConfig({ dailyMinutes: 45.5 }), TODAY).dailyMinutes);
    assert.ok(validateConfig(validConfig({ studyDays: [] }), TODAY).studyDays);
    assert.ok(validateConfig(validConfig({ studyDays: ['funday'] }), TODAY).studyDays);
    assert.ok(validateConfig(validConfig({ title: 'T'.repeat(81) }), TODAY).title);
    assert.ok(validateConfig(validConfig({ title: '<b>x</b>' }), TODAY).title);
    assert.ok(validateConfig(validConfig({ instructions: 'x'.repeat(301) }), TODAY).instructions);
  });

  it('rejects study days that never occur before the exam', () => {
    // Today is Sunday and the exam is tomorrow, so only Sunday is available.
    const errors = validateConfig(validConfig({ examDate: '2026-10-19', studyDays: ['monday'] }), TODAY);
    assert.match(errors.studyDays, /None of your selected study days/);
    assert.deepEqual(validateConfig(validConfig({ examDate: '2026-10-19', studyDays: ['sunday'] }), TODAY), {});
  });

  it('builds the exact request the backend expects', () => {
    const request = buildPlanRequest(validConfig({ title: '  Mid-sem   prep ', instructions: ' Focus on  numericals ', studyDays: ['friday', 'monday'] }), TODAY);
    assert.deepEqual(request, {
      title: 'Mid-sem prep',
      exam_date: '2026-10-25',
      start_date: TODAY,
      subjects: [
        { subject: 'DBMS', topics: ['Normalization', 'Transactions'], confidence: 'basic' },
        { subject: 'Operating Systems', topics: [], confidence: 'need_to_start' }
      ],
      daily_available_minutes: 120,
      preferred_study_days: ['monday', 'friday'],
      additional_instructions: 'Focus on numericals'
    });
  });

  it('omits blank optional fields from the request', () => {
    const request = buildPlanRequest(validConfig({ title: ' ', instructions: '' }), TODAY);
    assert.ok(!('title' in request));
    assert.ok(!('additional_instructions' in request));
  });
});

describe('parsePlanResponse', () => {
  it('accepts a valid plan and recomputes the totals itself', () => {
    const plan = parsePlanResponse({ status: 'success', plan: makePlan({ total_planned_minutes: 9999, total_tasks: 99 }) });
    assert.equal(plan.total_tasks, 5);
    assert.equal(plan.total_planned_minutes, 225);
    assert.equal(plan.schedule[0].total_minutes, 90);
  });

  it('rejects bodies that are not a success response', () => {
    for (const bad of [null, 'x', [], {}, { status: 'error' }, { status: 'success' }, { status: 'success', plan: null }]) {
      assert.throws(() => parsePlanResponse(bad), InvalidPlanResponseError);
    }
  });

  it('rejects structurally invalid plans', () => {
    const mutate = (fn) => {
      const plan = structuredClone(makePlan());
      fn(plan);
      return plan;
    };
    const cases = {
      'no id': mutate((p) => { p.id = ''; }),
      'bad exam date': mutate((p) => { p.exam_date = '2026-02-30'; }),
      'exam not after start': mutate((p) => { p.exam_date = p.start_date; }),
      'bad plan type': mutate((p) => { p.plan_type = 'weird'; }),
      'unknown subject': mutate((p) => { p.subjects = ['Astrology']; }),
      'empty schedule': mutate((p) => { p.schedule = []; }),
      'day on the exam date': mutate((p) => { p.schedule[2].date = '2026-10-22'; }),
      'day before the start': mutate((p) => { p.schedule[0].date = '2026-10-17'; }),
      'out of order': mutate((p) => { p.schedule.reverse(); }),
      'duplicate date': mutate((p) => { p.schedule[1].date = p.schedule[0].date; }),
      'excluded weekday': mutate((p) => { p.preferred_study_days = ['monday']; }),
      'duplicate task id': mutate((p) => { p.schedule[1].tasks[0].id = 'task-1'; }),
      'unselected subject': mutate((p) => { p.schedule[0].tasks[0].subject = 'Java'; }),
      'bad activity': mutate((p) => { p.schedule[0].tasks[0].activity_type = 'nap'; }),
      'string duration': mutate((p) => { p.schedule[0].tasks[0].duration_minutes = '45'; }),
      'zero duration': mutate((p) => { p.schedule[0].tasks[0].duration_minutes = 0; }),
      'over daily limit': mutate((p) => { p.daily_available_minutes = 60; }),
      'no tasks': mutate((p) => { p.schedule[0].tasks = []; }),
      'blank description': mutate((p) => { p.schedule[0].tasks[0].description = ' '; })
    };

    for (const [name, plan] of Object.entries(cases)) {
      assert.throws(() => normalizePlan(plan), InvalidPlanResponseError, name);
    }
  });

  it('treats a non-boolean completed flag as not completed', () => {
    const plan = makePlan();
    plan.schedule[0].tasks[0].completed = 'yes';
    assert.equal(normalizePlan(plan).schedule[0].tasks[0].completed, false);
  });
});

describe('progress', () => {
  const plan = normalizePlan(makePlan());

  it('is zero with no completed tasks', () => {
    const progress = calculateProgress(plan);
    assert.equal(progress.totalTasks, 5);
    assert.equal(progress.completedTasks, 0);
    assert.equal(progress.remainingTasks, 5);
    assert.equal(progress.percentage, 0);
    assert.equal(progress.completedMinutes, 0);
    assert.equal(progress.totalMinutes, 225);
  });

  it('follows the real completion flags', () => {
    const next = setTaskCompleted(setTaskCompleted(plan, 'task-1', true), 'task-4', true);
    const progress = calculateProgress(next);
    assert.equal(progress.completedTasks, 2);
    assert.equal(progress.remainingTasks, 3);
    assert.equal(progress.percentage, 40);
    assert.equal(progress.completedMinutes, 90);
  });

  it('is 100 when every task is completed', () => {
    let next = plan;
    for (let i = 1; i <= 5; i += 1) next = setTaskCompleted(next, `task-${i}`, true);
    assert.equal(calculateProgress(next).percentage, 100);
    assert.equal(calculateProgress(next).remainingTasks, 0);
  });

  it('handles an empty task list without dividing by zero', () => {
    const empty = { ...plan, schedule: [] };
    const progress = calculateProgress(empty);
    assert.equal(progress.totalTasks, 0);
    assert.equal(progress.percentage, 0);
    assert.equal(Number.isNaN(progress.percentage), false);
    assert.equal(calculateSubjectProgress(empty)[0].percentage, 0);
  });

  it('calculates progress per subject', () => {
    const next = setTaskCompleted(setTaskCompleted(plan, 'task-1', true), 'task-3', true);
    const [dbms, os] = calculateSubjectProgress(next);
    assert.equal(dbms.subject, 'DBMS');
    assert.equal(dbms.totalTasks, 3);
    assert.equal(dbms.completedTasks, 2);
    assert.ok(Math.abs(dbms.percentage - 66.6667) < 0.001);
    assert.equal(os.totalTasks, 2);
    assert.equal(os.completedTasks, 0);
    assert.equal(os.percentage, 0);
  });

  it('keeps a subject with no tasks at 0 percent', () => {
    const onlyDbms = { ...plan, subjects: ['DBMS', 'Java'] };
    assert.equal(calculateSubjectProgress(onlyDbms)[1].totalTasks, 0);
    assert.equal(calculateSubjectProgress(onlyDbms)[1].percentage, 0);
  });

  it('summarises a day', () => {
    const next = setTaskCompleted(plan, 'task-1', true);
    assert.deepEqual(calculateDayStats(next.schedule[0]), { totalTasks: 2, completedTasks: 1, totalMinutes: 90, isComplete: false });
    assert.equal(calculateDayStats(setTaskCompleted(next, 'task-2', true).schedule[0]).isComplete, true);
    assert.equal(calculateDayStats({ tasks: [] }).isComplete, false);
  });
});

describe('toggling and filtering', () => {
  const plan = normalizePlan(makePlan());

  it('changes only the targeted task and leaves everything else identical', () => {
    const next = setTaskCompleted(plan, 'task-3', true);
    assert.equal(next.schedule[1].tasks[0].completed, true);
    assert.equal(plan.schedule[1].tasks[0].completed, false, 'the original plan is not mutated');
    assert.equal(next.schedule[0], plan.schedule[0], 'unchanged days keep their identity');
    assert.equal(next.schedule[2], plan.schedule[2]);
    assert.equal(next.schedule[1].tasks[1], plan.schedule[1].tasks[1]);
  });

  it('can untick a task and ignores no-ops and unknown ids', () => {
    const done = setTaskCompleted(plan, 'task-1', true);
    assert.equal(setTaskCompleted(done, 'task-1', false).schedule[0].tasks[0].completed, false);
    assert.equal(setTaskCompleted(plan, 'task-1', false), plan);
    assert.equal(setTaskCompleted(plan, 'missing', true), plan);
  });

  it('does not share state between two plans built from the same data', () => {
    const copyA = normalizePlan(makePlan());
    const copyB = normalizePlan(makePlan());
    setTaskCompleted(copyA, 'task-1', true);
    assert.equal(copyB.schedule[0].tasks[0].completed, false);
  });

  it('filters tasks and schedules', () => {
    const next = setTaskCompleted(setTaskCompleted(plan, 'task-1', true), 'task-2', true);
    assert.equal(filterTasks(next.schedule[0].tasks, 'all').length, 2);
    assert.equal(filterTasks(next.schedule[0].tasks, 'completed').length, 2);
    assert.equal(filterTasks(next.schedule[0].tasks, 'incomplete').length, 0);

    assert.equal(filterSchedule(next, 'all').length, 3);
    assert.deepEqual(filterSchedule(next, 'incomplete').map((e) => e.day.date), ['2026-10-19', '2026-10-20']);
    assert.deepEqual(filterSchedule(next, 'completed').map((e) => e.day.date), ['2026-10-18']);
    assert.deepEqual(countByFilter(next), { all: 5, incomplete: 3, completed: 2 });
    assert.equal(filterSchedule(plan, 'completed').length, 0);
  });

  it('picks the date to focus on', () => {
    assert.equal(getFocusDate(plan, '2026-10-18'), '2026-10-18');
    assert.equal(getFocusDate(plan, '2026-10-19'), '2026-10-19');
    const day1Done = setTaskCompleted(setTaskCompleted(plan, 'task-1', true), 'task-2', true);
    assert.equal(getFocusDate(day1Done, '2026-10-18'), '2026-10-19');
    let allDone = plan;
    for (let i = 1; i <= 5; i += 1) allDone = setTaskCompleted(allDone, `task-${i}`, true);
    assert.equal(getFocusDate(allDone, '2026-10-18'), '2026-10-18');
    assert.equal(getFocusDate(plan, '2026-10-21'), '2026-10-18', 'falls back to the first unfinished day once all days are past');
  });
});
