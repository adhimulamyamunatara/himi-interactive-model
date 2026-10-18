import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  actionRoute,
  buildProgressSummary,
  buildTutorRequest,
  InvalidTutorResponseError,
  MAX_HISTORY_TURNS,
  MAX_MESSAGE_CHARS,
  parseTutorResponse
} from './tutor.js';

const plan = { goal: 'Understand deadlock', steps: [{ title: 'Define it', detail: 'Processes wait forever.', kind: 'learn' }] };
const answerPayload = (overrides = {}) => ({
  requestId: 'abc123',
  outcome: 'answer',
  intent: 'explain',
  agent: 'subject_tutor',
  language: 'en',
  helpMode: 'guided',
  answer: 'A deadlock is when processes wait on each other.',
  plan,
  followUps: ['What are the four conditions?'],
  suggestedActions: [{ kind: 'quiz', label: 'Quiz me', topic: 'Deadlock' }],
  review: { passed: true, issues: [] },
  trace: [{ agent: 'orchestrator', action: 'route:explain', status: 'ok', ms: 1 }],
  modelCalls: 1,
  ...overrides
});

const attempt = (id, subject, topic, percentage, submittedAt) => ({ id, subject, topic, percentage, total: 5, correct: 3, submittedAt });

/* ----------------------------------------------------------------- request */

test('buildTutorRequest trims, caps and omits empty optional fields', () => {
  const request = buildTutorRequest({
    message: `  ${'x'.repeat(MAX_MESSAGE_CHARS + 50)}  `,
    subject: 'DBMS',
    topic: '   ',
    userName: '  ',
    language: 'te',
    helpMode: 'hint'
  });

  assert.equal(request.message.length, MAX_MESSAGE_CHARS);
  assert.equal('topic' in request, false);
  assert.equal('progress' in request, false);
  assert.equal(request.userName, 'Student');
  assert.equal(request.language, 'te');
  assert.equal(request.helpMode, 'hint');
});

test('buildTutorRequest keeps only the most recent history turns', () => {
  const history = Array.from({ length: 10 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `turn ${index}` }));
  const request = buildTutorRequest({ message: 'next', subject: 'AI', userName: 'Asha', language: 'en', helpMode: 'guided', history });

  assert.equal(request.history.length, MAX_HISTORY_TURNS);
  assert.equal(request.history.at(-1).content, 'turn 9');
});

test('buildProgressSummary is null with no attempts in the subject (nothing is invented)', () => {
  assert.equal(buildProgressSummary([], 'DBMS'), null);
  assert.equal(buildProgressSummary([attempt('1', 'Python', 'Loops', 90, '2026-01-01T00:00:00Z')], 'DBMS'), null);
});

test('buildProgressSummary averages only the subject and lists weak topics', () => {
  const attempts = [
    attempt('1', 'DBMS', 'Normalization', 40, '2026-01-01T00:00:00Z'),
    attempt('2', 'DBMS', 'SQL', 100, '2026-01-02T00:00:00Z'),
    attempt('3', 'Python', 'Loops', 10, '2026-01-03T00:00:00Z')
  ];
  const summary = buildProgressSummary(attempts, 'DBMS');

  assert.equal(summary.attempts, 2);
  assert.equal(summary.averagePercent, 70);
  assert.deepEqual(summary.weakTopics, ['Normalization']);
});

/* ---------------------------------------------------------------- response */

test('parseTutorResponse accepts a valid answer', () => {
  const result = parseTutorResponse(answerPayload());
  assert.equal(result.outcome, 'answer');
  assert.equal(result.plan.steps.length, 1);
  assert.equal(result.suggestedActions[0].kind, 'quiz');
  assert.equal(result.followUps.length, 1);
});

test('parseTutorResponse rejects non-objects and unknown outcomes', () => {
  for (const bad of [null, undefined, 'text', 4, [], {}, answerPayload({ outcome: 'weird' }), answerPayload({ intent: 'hack' })]) {
    assert.throws(() => parseTutorResponse(bad), InvalidTutorResponseError);
  }
});

test('parseTutorResponse rejects an answer with no text or no plan', () => {
  assert.throws(() => parseTutorResponse(answerPayload({ answer: '   ' })), InvalidTutorResponseError);
  assert.throws(() => parseTutorResponse(answerPayload({ plan: null })), InvalidTutorResponseError);
  assert.throws(() => parseTutorResponse(answerPayload({ plan: { goal: 'x', steps: [] } })), InvalidTutorResponseError);
  assert.throws(() => parseTutorResponse(answerPayload({ plan: { goal: 'x', steps: [{ title: 'a' }] } })), InvalidTutorResponseError);
});

test('parseTutorResponse drops unknown action kinds instead of trusting them', () => {
  const result = parseTutorResponse(
    answerPayload({ suggestedActions: [{ kind: 'delete_everything' }, { kind: 'notes' }, 'junk', null] })
  );
  assert.deepEqual(result.suggestedActions.map((action) => action.kind), ['notes']);
});

test('parseTutorResponse tolerates missing optional fields', () => {
  const result = parseTutorResponse(answerPayload({ followUps: undefined, suggestedActions: undefined, review: undefined, trace: undefined, modelCalls: undefined }));
  assert.deepEqual(result.followUps, []);
  assert.deepEqual(result.suggestedActions, []);
  assert.equal(result.review, null);
  assert.deepEqual(result.trace, []);
  assert.equal(result.modelCalls, 0);
});

test('parseTutorResponse keeps markup as plain text (rendering escapes it)', () => {
  const result = parseTutorResponse(answerPayload({ answer: '<script>alert(1)</script> text' }));
  assert.equal(result.answer, '<script>alert(1)</script> text');
});

test('parseTutorResponse handles clarify and handoff outcomes', () => {
  const clarify = parseTutorResponse({ requestId: 'r', outcome: 'clarify', intent: 'clarify', agent: 'orchestrator', language: 'en', clarify: { reason: 'too_vague' } });
  assert.equal(clarify.clarify.reason, 'too_vague');

  const handoff = parseTutorResponse({ requestId: 'r', outcome: 'handoff', intent: 'quiz', agent: 'orchestrator', language: 'en', handoff: { kind: 'quiz', subject: 'DBMS', topic: 'SQL' } });
  assert.equal(handoff.handoff.kind, 'quiz');

  assert.throws(
    () => parseTutorResponse({ requestId: 'r', outcome: 'handoff', intent: 'quiz', agent: 'orchestrator', language: 'en', handoff: { kind: 'rm -rf' } }),
    InvalidTutorResponseError
  );
});

test('parseTutorResponse normalises an unknown language to English and drops bad trace rows', () => {
  const result = parseTutorResponse(answerPayload({ language: 'xx', trace: [{ agent: 'a', action: 'b', status: 'bogus', ms: 1 }, { agent: 'a', action: 'b', status: 'ok', ms: -5 }] }));
  assert.equal(result.language, 'en');
  assert.equal(result.trace.length, 1);
  assert.equal(result.trace[0].ms, 0);
});

/* ------------------------------------------------------------------ actions */

test('actionRoute maps each kind to an existing page and encodes parameters', () => {
  assert.equal(actionRoute('quiz', { subject: 'Operating Systems', topic: 'A&B #1' }), '/quiz?subject=Operating+Systems&topic=A%26B+%231');
  assert.equal(actionRoute('quiz', {}), '/quiz');
  assert.equal(actionRoute('planner', { subject: 'DBMS' }), '/study-planner?subject=DBMS');
  assert.equal(actionRoute('notes'), '/notes');
  assert.equal(actionRoute('whiteboard'), '/whiteboard');
  assert.equal(actionRoute('diagram', { topic: 'TCP' }), '/diagrams?topic=TCP');
});

test('parseTutorResponse accepts code and diagram handoffs', () => {
  for (const [intent, kind] of [['code_help', 'code'], ['visual', 'diagram']]) {
    const result = parseTutorResponse({ requestId: 'r', outcome: 'handoff', intent, agent: 'orchestrator', language: 'en', handoff: { kind, subject: 'Algorithms', topic: 'bubble sort' } });
    assert.equal(result.handoff.kind, kind);
  }
});

test('actionRoute opens the code assistant without carrying any code', () => {
  assert.equal(actionRoute('code', { subject: 'Python', topic: 'secret code' }), '/code');
});

test('actionRoute returns null for unknown kinds (no open redirects)', () => {
  assert.equal(actionRoute('https://evil.example'), null);
  assert.equal(actionRoute(undefined), null);
});
