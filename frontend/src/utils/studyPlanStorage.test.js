import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDefaultConfig, normalizePlan, setTaskCompleted } from './studyPlanner.js';
import {
  MAX_SAVED_PLANS,
  STUDY_PLANS_BACKUP_KEY,
  STUDY_PLANS_STORAGE_KEY,
  addPlanRecord,
  canAddPlan,
  configFromPlan,
  createPlanRecord,
  findPlanRecord,
  loadStudyPlans,
  parseRecord,
  removePlanRecord,
  replacePlanContent,
  saveStudyPlans,
  updatePlanInRecords
} from './studyPlanStorage.js';

/** Minimal in-memory Storage. */
function createStorage(initial = {}, { failWrites = false } = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      if (failWrites) throw new Error('QuotaExceededError');
      data.set(key, String(value));
    },
    removeItem: (key) => data.delete(key)
  };
}

const task = (id, subject) => ({
  id,
  subject,
  title: `Task ${id}`,
  description: `Do the work for ${id} carefully.`,
  duration_minutes: 45,
  activity_type: 'learn',
  completed: false
});

const makePlan = (id = 'plan-a', subject = 'DBMS') =>
  normalizePlan({
    id,
    title: `Plan ${id}`,
    exam_date: '2026-10-22',
    start_date: '2026-10-18',
    plan_type: 'standard',
    subjects: [subject],
    daily_available_minutes: 120,
    preferred_study_days: ['sunday', 'monday', 'tuesday', 'wednesday'],
    suggested_topic_subjects: [subject],
    notes: [],
    schedule: [
      { date: '2026-10-18', focus: 'Basics', tasks: [task(`${id}-1`, subject), task(`${id}-2`, subject)] },
      { date: '2026-10-19', focus: 'More', tasks: [task(`${id}-3`, subject)] }
    ]
  });

const makeConfig = (subject = 'DBMS') => ({
  ...createDefaultConfig(),
  title: 'T',
  examDate: '2026-10-22',
  subjects: [{ subject, topics: 'A, B', confidence: 'basic' }]
});

const makeRecord = (id, subject) => createPlanRecord(makePlan(id, subject), makeConfig(subject), new Date('2026-10-18T10:00:00Z'));

describe('study plan storage', () => {
  it('uses its own versioned key', () => {
    assert.equal(STUDY_PLANS_STORAGE_KEY, 'himi_study_plans_v1');
    assert.notEqual(STUDY_PLANS_STORAGE_KEY, 'himi.user');
    assert.notEqual(STUDY_PLANS_STORAGE_KEY, 'himi.chat.state');
  });

  it('returns an empty list when nothing is stored', () => {
    assert.deepEqual(loadStudyPlans(createStorage()), { plans: [], issue: null, skipped: 0 });
  });

  it('round-trips plans, including completion state, after a "reload"', () => {
    const storage = createStorage();
    const record = makeRecord('plan-a');
    const ticked = { ...record, plan: setTaskCompleted(record.plan, 'plan-a-2', true) };

    assert.equal(saveStudyPlans([ticked, makeRecord('plan-b', 'Java')], storage), true);

    const loaded = loadStudyPlans(storage);
    assert.equal(loaded.issue, null);
    assert.equal(loaded.plans.length, 2);
    assert.equal(loaded.plans[0].plan.schedule[0].tasks[1].completed, true);
    assert.equal(loaded.plans[0].plan.schedule[0].tasks[0].completed, false);
    assert.equal(loaded.plans[0].config.subjects[0].topics, 'A, B');
    assert.equal(loaded.plans[1].plan.subjects[0], 'Java');
  });

  it('never touches other storage keys', () => {
    const storage = createStorage({ 'himi.user': '{"name":"A"}', 'himi.chat.state': '{"messages":[]}' });
    saveStudyPlans([makeRecord('plan-a')], storage);
    assert.equal(storage.getItem('himi.user'), '{"name":"A"}');
    assert.equal(storage.getItem('himi.chat.state'), '{"messages":[]}');
  });

  it('survives malformed JSON and keeps a backup of it', () => {
    const storage = createStorage({ [STUDY_PLANS_STORAGE_KEY]: '{not json' });
    const loaded = loadStudyPlans(storage);
    assert.deepEqual(loaded.plans, []);
    assert.equal(loaded.issue, 'unreadable');
    assert.equal(storage.getItem(STUDY_PLANS_BACKUP_KEY), '{not json');
  });

  it('survives data with the wrong shape or version', () => {
    for (const value of ['null', '[]', '"text"', '42', '{"version":99,"plans":[]}', '{"version":1}', '{"version":1,"plans":"x"}']) {
      const loaded = loadStudyPlans(createStorage({ [STUDY_PLANS_STORAGE_KEY]: value }));
      assert.deepEqual(loaded.plans, [], value);
      assert.equal(loaded.issue, 'unreadable', value);
    }
  });

  it('skips unusable records but keeps the good ones', () => {
    const good = makeRecord('plan-a');
    const broken = [
      null,
      'string',
      { id: 'no-plan' },
      { id: 'bad id with spaces!', plan: good.plan },
      { id: 'plan-x', plan: { ...good.plan, schedule: 'oops' } },
      { id: 'plan-y', plan: { ...good.plan, subjects: ['Astrology'] } },
      { ...good } // duplicate id
    ];
    const storage = createStorage({
      [STUDY_PLANS_STORAGE_KEY]: JSON.stringify({ version: 1, plans: [good, ...broken] })
    });
    const loaded = loadStudyPlans(storage);
    assert.equal(loaded.plans.length, 1);
    assert.equal(loaded.plans[0].id, 'plan-a');
    assert.equal(loaded.issue, 'partial');
    assert.equal(loaded.skipped, broken.length);
    assert.ok(storage.getItem(STUDY_PLANS_BACKUP_KEY));
  });

  it('rebuilds the form values from the plan when stored ones are invalid', () => {
    const good = makeRecord('plan-a');
    const record = parseRecord({ ...good, config: { title: 5, subjects: 'x' } });
    assert.deepEqual(record.config, configFromPlan(record.plan));
    assert.equal(record.config.examDate, '2026-10-22');
    assert.equal(record.config.subjects[0].subject, 'DBMS');
  });

  it('defaults broken timestamps instead of failing', () => {
    const record = parseRecord({ ...makeRecord('plan-a'), createdAt: 'nope', updatedAt: 12 });
    assert.equal(record.createdAt, new Date(0).toISOString());
  });

  it('caps the number of loaded plans', () => {
    const many = Array.from({ length: MAX_SAVED_PLANS + 3 }, (_, i) => makeRecord(`plan-${i}`));
    const storage = createStorage({ [STUDY_PLANS_STORAGE_KEY]: JSON.stringify({ version: 1, plans: many }) });
    assert.equal(loadStudyPlans(storage).plans.length, MAX_SAVED_PLANS);
  });

  it('reports blocked storage without throwing', () => {
    assert.equal(loadStudyPlans(null).issue, 'unavailable');
    assert.equal(saveStudyPlans([], null), false);

    const throwing = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('x'); } };
    assert.equal(loadStudyPlans(throwing).issue, 'unavailable');
    assert.equal(saveStudyPlans([makeRecord('plan-a')], throwing), false);
  });

  it('reports a failed write (quota exceeded)', () => {
    assert.equal(saveStudyPlans([makeRecord('plan-a')], createStorage({}, { failWrites: true })), false);
  });

  it('does not store secrets: only plan data, form values and timestamps', () => {
    const storage = createStorage();
    saveStudyPlans([makeRecord('plan-a')], storage);
    const stored = JSON.parse(storage.getItem(STUDY_PLANS_STORAGE_KEY));
    assert.deepEqual(Object.keys(stored), ['version', 'plans']);
    assert.deepEqual(Object.keys(stored.plans[0]).sort(), ['config', 'createdAt', 'id', 'plan', 'title', 'updatedAt']);
    assert.ok(!/api[_-]?key|token|secret/i.test(storage.getItem(STUDY_PLANS_STORAGE_KEY)));
  });
});

describe('record updates', () => {
  const a = makeRecord('plan-a');
  const b = makeRecord('plan-b', 'Java');
  const later = new Date('2026-10-19T09:30:00Z');

  it('supports several plans, newest first', () => {
    const list = addPlanRecord(addPlanRecord([], a), b);
    assert.deepEqual(list.map((r) => r.id), ['plan-b', 'plan-a']);
    assert.equal(findPlanRecord(list, 'plan-a'), a);
    assert.equal(findPlanRecord(list, 'missing'), null);
  });

  it('does not duplicate a plan that is added twice', () => {
    assert.equal(addPlanRecord([a], a).length, 1);
  });

  it('updates only the edited plan when a task is ticked', () => {
    const list = [a, b];
    const ticked = setTaskCompleted(a.plan, 'plan-a-1', true);
    const next = updatePlanInRecords(list, 'plan-a', ticked, later);

    assert.equal(next[0].plan.schedule[0].tasks[0].completed, true);
    assert.equal(next[0].updatedAt, later.toISOString());
    assert.equal(next[1], b, 'the other plan is the very same object');
    assert.equal(a.plan.schedule[0].tasks[0].completed, false, 'the input is not mutated');
  });

  it('replaces the schedule of one plan on regenerate and keeps its id and creation time', () => {
    const fresh = makePlan('new-backend-id');
    const next = replacePlanContent([a, b], 'plan-a', fresh, makeConfig('Python'), later);
    assert.equal(next[0].id, 'plan-a');
    assert.equal(next[0].createdAt, a.createdAt);
    assert.equal(next[0].plan.id, 'new-backend-id');
    assert.equal(next[0].config.subjects[0].subject, 'Python');
    assert.equal(next[1], b);
  });

  it('deletes only the chosen plan', () => {
    const next = removePlanRecord([a, b], 'plan-a');
    assert.deepEqual(next.map((r) => r.id), ['plan-b']);
    assert.deepEqual(removePlanRecord(next, 'plan-b'), []);
    assert.equal(removePlanRecord(next, 'missing').length, 1);
  });

  it('limits how many plans can be added', () => {
    const full = Array.from({ length: MAX_SAVED_PLANS }, (_, i) => makeRecord(`p${i}`));
    assert.equal(canAddPlan(full), false);
    assert.equal(canAddPlan(full.slice(1)), true);
  });
});
