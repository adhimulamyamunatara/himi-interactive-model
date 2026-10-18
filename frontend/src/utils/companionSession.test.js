import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createCompanionSession, MAX_ENTRIES } from './companionSession.js';
import { MAX_MESSAGE_CHARS } from './tutor.js';

const answer = (text) => ({ outcome: 'answer', intent: 'explain', answer: text, language: 'en', requestId: 'r' });

/** A controllable fake tutor: each call returns a promise the test settles by hand. */
function fakeAsk() {
  const calls = [];
  const ask = (request, { signal }) =>
    new Promise((resolve, reject) => {
      calls.push({ request, resolve, reject });
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { code: 'ERR_CANCELED' })));
    });

  return { ask, calls };
}

/** Timers the test fires by hand, so "ends by itself" can be checked without waiting. */
function fakeTimers() {
  const pending = new Map();
  let next = 1;

  return {
    setTimer: (fn, ms) => {
      pending.set(next, { fn, ms });
      return next++;
    },
    clearTimer: (id) => pending.delete(id),
    fireAll: () => [...pending.values()].forEach(({ fn }) => fn()) || pending.clear(),
    count: () => pending.size,
    durations: () => [...pending.values()].map(({ ms }) => ms)
  };
}

const build = (history) => ({ history });
const make = (options = {}) => {
  const tutor = fakeAsk();
  const timers = fakeTimers();
  const session = createCompanionSession({
    ask: tutor.ask,
    describeError: (error) => ({ kind: 'server', message: error?.message ?? null }),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    ...options
  });

  return { session, tutor, timers };
};
const kinds = (session) => session.getSnapshot().entries.map((entry) => entry.kind);

describe('message lifecycle', () => {
  test('a question becomes thinking, then a displayed answer, then idle', async () => {
    const { session, tutor } = make();
    const sending = session.send('What is a deadlock?', build, { subject: 'Operating Systems' });

    assert.equal(session.getSnapshot().status, 'thinking');
    assert.deepEqual(kinds(session), ['user']);

    tutor.calls[0].resolve(answer('A deadlock is a standstill.'));
    assert.deepEqual(await sending, { started: true });

    const snapshot = session.getSnapshot();
    assert.equal(snapshot.status, 'idle');
    assert.deepEqual(kinds(session), ['user', 'answer']);
    assert.equal(snapshot.entries[1].text, 'A deadlock is a standstill.');
    assert.equal(snapshot.entries[1].subject, 'Operating Systems');
  });

  test('the model receives the conversation so far', async () => {
    const { session, tutor } = make();
    const first = session.send('one', build);
    tutor.calls[0].resolve(answer('a1'));
    await first;

    const second = session.send('two', build);
    assert.equal(tutor.calls[1].request.history.length, 2);
    tutor.calls[1].resolve(answer('a2'));
    await second;
    assert.deepEqual(kinds(session), ['user', 'answer', 'user', 'answer']);
  });

  test('blank and oversized input never reaches the model', async () => {
    const { session, tutor } = make();

    assert.deepEqual(await session.send('   ', build), { started: false, reason: 'empty' });
    assert.deepEqual(await session.send(undefined, build), { started: false, reason: 'empty' });
    assert.deepEqual(await session.send('x'.repeat(MAX_MESSAGE_CHARS + 1), build), { started: false, reason: 'too-long' });
    assert.equal(tutor.calls.length, 0);
    assert.equal(session.getSnapshot().entries.length, 0);
  });

  test('an answer sets the teaching state, which ends by itself', async () => {
    const { session, tutor, timers } = make();
    const sending = session.send('q', build);
    tutor.calls[0].resolve(answer('a'));
    await sending;

    assert.equal(session.getSnapshot().teaching, true);
    timers.fireAll();
    assert.equal(session.getSnapshot().teaching, false);
  });

  test('a clarification is shown without becoming conversation context', async () => {
    const { session, tutor } = make();
    const sending = session.send('help', build);
    tutor.calls[0].resolve({ outcome: 'clarify', intent: 'clarify', clarify: { reason: 'too_vague' } });
    await sending;

    assert.deepEqual(kinds(session), ['user', 'clarify']);
    assert.equal(session.getSnapshot().teaching, false);

    const next = session.send('quiz on os', build);
    assert.deepEqual(tutor.calls[1].request.history, []);
    tutor.calls[1].resolve(answer('ok'));
    await next;
  });

  test('a tool handoff is recorded with its destination and the subject it was asked under', async () => {
    const { session, tutor } = make();
    const sending = session.send('quiz me on operating systems', build, { subject: 'DBMS' });
    tutor.calls[0].resolve({ outcome: 'handoff', intent: 'quiz', handoff: { kind: 'quiz', subject: 'Operating Systems', topic: null } });
    await sending;

    const entry = session.getSnapshot().entries[1];
    assert.equal(entry.kind, 'handoff');
    assert.equal(entry.handoff.kind, 'quiz');
    assert.equal(entry.handoff.subject, 'Operating Systems');
    assert.equal(entry.subject, 'DBMS');
    assert.equal(session.getSnapshot().status, 'idle');
  });
});

describe('duplicate submissions', () => {
  test('a second send while thinking is ignored, however it is triggered', async () => {
    const { session, tutor } = make();
    const first = session.send('q', build);
    const results = await Promise.all([session.send('q', build), session.send('q', build), session.send('other', build)]);

    assert.ok(results.every((result) => result.started === false && result.reason === 'busy'));
    assert.equal(tutor.calls.length, 1);
    assert.deepEqual(kinds(session), ['user']);
    tutor.calls[0].resolve(answer('a'));
    await first;
  });

  test('the same text may be asked again once the first request finished', async () => {
    const { session, tutor } = make();
    const first = session.send('q', build);
    tutor.calls[0].resolve(answer('a'));
    await first;

    const again = session.send('q', build);
    assert.equal(tutor.calls.length, 2);
    tutor.calls[1].resolve(answer('a'));
    await again;
  });
});

describe('failure, stop and retry', () => {
  test('a failed request ends the thinking state and shows an error with a retry', async () => {
    const { session, tutor } = make();
    const sending = session.send('q', build);
    tutor.calls[0].reject(new Error('server down'));

    assert.deepEqual(await sending, { started: true, reason: 'error' });
    const snapshot = session.getSnapshot();
    assert.equal(snapshot.status, 'error');
    assert.equal(snapshot.error.kind, 'server');
    assert.deepEqual(kinds(session), ['user', 'error']);
  });

  test('retry asks the same question again and replaces the failed line', async () => {
    const { session, tutor } = make();
    const sending = session.send('why is the sky blue', build, { subject: 'AI' });
    tutor.calls[0].reject(new Error('boom'));
    await sending;

    const retrying = session.retry(build);
    assert.equal(session.getSnapshot().status, 'thinking');
    assert.deepEqual(kinds(session), ['user']);
    assert.equal(tutor.calls.length, 2);
    tutor.calls[1].resolve(answer('Rayleigh scattering.'));
    await retrying;

    assert.deepEqual(kinds(session), ['user', 'answer']);
    assert.equal(session.getSnapshot().entries[1].subject, 'AI');
    assert.equal(session.getSnapshot().status, 'idle');
  });

  test('retry with nothing to retry, or while busy, does nothing', async () => {
    const { session, tutor } = make();
    assert.deepEqual(await session.retry(build), { started: false, reason: 'nothing-to-retry' });

    const sending = session.send('q', build);
    assert.deepEqual(await session.retry(build), { started: false, reason: 'busy' });
    tutor.calls[0].resolve(answer('a'));
    await sending;
  });

  test('stopping ends the thinking state at once and discards the late answer', async () => {
    const { session, tutor } = make();
    const sending = session.send('q', build);

    assert.equal(session.cancel(), true);
    assert.equal(session.getSnapshot().status, 'idle');
    assert.deepEqual(kinds(session), ['user', 'stopped']);

    tutor.calls[0].resolve(answer('too late'));
    assert.equal((await sending).reason, 'stale');
    assert.deepEqual(kinds(session), ['user', 'stopped']);
  });

  test('cancel when nothing is running is a no-op', () => {
    const { session } = make();
    assert.equal(session.cancel(), false);
    assert.deepEqual(kinds(session), []);
  });

  test('after a stop the student can retry or ask something new', async () => {
    const { session, tutor } = make();
    const sending = session.send('q', build);
    session.cancel();
    await sending.catch(() => {});

    const retrying = session.retry(build);
    tutor.calls[1].resolve(answer('now'));
    await retrying;
    assert.deepEqual(kinds(session), ['user', 'answer']);
  });
});

describe('session ownership and stale responses', () => {
  test('reset while waiting discards the old answer: it can never appear in the next conversation', async () => {
    const { session, tutor } = make();
    const sending = session.send('student one question', build);

    session.reset();
    assert.equal(session.getSnapshot().status, 'idle');
    assert.deepEqual(kinds(session), []);

    const next = session.send('student two question', build);
    tutor.calls[0].resolve(answer('answer for student one'));
    assert.equal((await sending).reason, 'stale');
    assert.deepEqual(kinds(session), ['user']);
    assert.equal(session.getSnapshot().entries[0].text, 'student two question');

    tutor.calls[1].resolve(answer('answer for student two'));
    await next;
    assert.deepEqual(session.getSnapshot().entries.map((entry) => entry.text), ['student two question', 'answer for student two']);
  });

  test('a failure that arrives after a reset is silent too', async () => {
    const { session, tutor } = make();
    const sending = session.send('q', build);
    session.reset();
    tutor.calls[0].reject(new Error('late failure'));
    await sending;

    assert.equal(session.getSnapshot().status, 'idle');
    assert.equal(session.getSnapshot().error, null);
    assert.deepEqual(kinds(session), []);
  });

  test('reset forgets the model context and bumps the epoch so voice input can reset too', async () => {
    const { session, tutor } = make();
    const first = session.send('one', build);
    tutor.calls[0].resolve(answer('a1'));
    await first;

    const before = session.getSnapshot().epoch;
    session.reset();
    assert.equal(session.getSnapshot().epoch, before + 1);

    const second = session.send('two', build);
    assert.deepEqual(tutor.calls[1].request.history, []);
    tutor.calls[1].resolve(answer('a2'));
    await second;
  });

  test('entry ids are unique within and across conversations', async () => {
    const { session, tutor } = make();
    const first = session.send('one', build);
    tutor.calls[0].resolve(answer('a1'));
    await first;
    const ids = session.getSnapshot().entries.map((entry) => entry.id);

    session.reset();
    const second = session.send('one', build);
    tutor.calls[1].resolve(answer('a1'));
    await second;
    const all = [...ids, ...session.getSnapshot().entries.map((entry) => entry.id)];

    assert.equal(new Set(all).size, all.length);
  });

  test('the transcript survives dispose and remount (React StrictMode) but nothing stays in flight', async () => {
    const { session, tutor } = make();
    const done = session.send('one', build);
    tutor.calls[0].resolve(answer('a1'));
    await done;

    session.dispose();
    assert.deepEqual(kinds(session), ['user', 'answer']);

    const pending = session.send('two', build);
    session.dispose();
    assert.equal(session.getSnapshot().status, 'idle');
    tutor.calls[1].resolve(answer('late'));
    await pending;
    assert.deepEqual(kinds(session), ['user', 'answer', 'user']);
  });
});

describe('local open commands', () => {
  test('"open the whiteboard" is answered locally with no model call', async () => {
    const { session, tutor } = make();
    const result = await session.send('open the whiteboard', build);

    assert.deepEqual(result, { started: true, reason: 'local', to: '/whiteboard' });
    assert.equal(tutor.calls.length, 0);
    assert.deepEqual(kinds(session), ['user', 'open']);
    assert.equal(session.getSnapshot().entries[1].to, '/whiteboard');
    assert.equal(session.getSnapshot().status, 'idle');
  });

  test('a question that mentions a tool is still sent to the tutor', async () => {
    const { session, tutor } = make();
    const sending = session.send('open the whiteboard and explain trees', build);

    assert.equal(tutor.calls.length, 1);
    tutor.calls[0].resolve(answer('Trees are...'));
    await sending;
  });

  test('a local command is ignored while a request is running', async () => {
    const { session, tutor } = make();
    const sending = session.send('q', build);

    assert.equal((await session.send('open notes', build)).reason, 'busy');
    tutor.calls[0].resolve(answer('a'));
    await sending;
  });
});

describe('celebrating and housekeeping', () => {
  test('celebrate lasts the requested time and then ends by itself', () => {
    const { session, timers } = make();

    session.celebrate(1200);
    assert.equal(session.getSnapshot().celebrating, true);
    assert.deepEqual(timers.durations(), [1200]);

    timers.fireAll();
    assert.equal(session.getSnapshot().celebrating, false);
  });

  test('celebrating twice does not leave a second timer behind', () => {
    const { session, timers } = make();
    session.celebrate();
    session.celebrate();
    assert.equal(timers.count(), 1);
  });

  test('reset clears the short states and their timers', async () => {
    const { session, tutor, timers } = make();
    const sending = session.send('q', build);
    tutor.calls[0].resolve(answer('a'));
    await sending;
    session.celebrate();

    session.reset();
    assert.equal(session.getSnapshot().celebrating, false);
    assert.equal(session.getSnapshot().teaching, false);
    assert.equal(timers.count(), 0);
  });

  test('the transcript is capped so a long session cannot grow without bound', async () => {
    const { session } = make();

    for (let i = 0; i < MAX_ENTRIES; i += 1) {
      await session.send('open notes', build);
    }

    assert.ok(session.getSnapshot().entries.length <= MAX_ENTRIES);
  });

  test('subscribers are notified and can unsubscribe', async () => {
    const { session } = make();
    let calls = 0;
    const unsubscribe = session.subscribe(() => {
      calls += 1;
    });

    await session.send('open notes', build);
    assert.ok(calls > 0);

    unsubscribe();
    const seen = calls;
    await session.send('open notes', build);
    assert.equal(calls, seen);
  });
});
