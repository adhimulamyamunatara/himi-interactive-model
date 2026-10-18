import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTutorSession } from './tutorSession.js';

const answer = (text) => ({ outcome: 'answer', answer: text });

/** A controllable fake `ask`: every call returns a promise the test settles by hand. */
function fakeAsk() {
  const calls = [];
  const ask = (request, { signal }) =>
    new Promise((resolve, reject) => {
      const call = { request, signal, resolve, reject };
      calls.push(call);
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { code: 'ERR_CANCELED' })));
    });

  return { ask, calls };
}

test('a successful request stores the result and builds history', async () => {
  const { ask, calls } = fakeAsk();
  const session = createTutorSession({ ask });
  const sending = session.send((history) => ({ history }), 'What is a deadlock?');

  assert.equal(session.getSnapshot().status, 'loading');
  calls[0].resolve(answer('It is a standstill.'));
  assert.deepEqual(await sending, { started: true });

  const snapshot = session.getSnapshot();
  assert.equal(snapshot.status, 'success');
  assert.equal(snapshot.result.answer, 'It is a standstill.');
  assert.deepEqual(snapshot.history, [
    { role: 'user', content: 'What is a deadlock?' },
    { role: 'assistant', content: 'It is a standstill.' }
  ]);
});

test('the next request is built with the conversation so far', async () => {
  const { ask, calls } = fakeAsk();
  const session = createTutorSession({ ask });

  const first = session.send(() => ({}), 'one');
  calls[0].resolve(answer('a1'));
  await first;

  const second = session.send((history) => ({ history }), 'two');
  assert.equal(calls[1].request.history.length, 2);
  calls[1].resolve(answer('a2'));
  await second;
  assert.equal(session.getSnapshot().history.length, 4);
});

test('a second send while loading is ignored (no duplicate request)', async () => {
  const { ask, calls } = fakeAsk();
  const session = createTutorSession({ ask });
  const first = session.send(() => ({}), 'q');
  const second = await session.send(() => ({}), 'q again');

  assert.deepEqual(second, { started: false, reason: 'busy' });
  assert.equal(calls.length, 1);
  calls[0].resolve(answer('ok'));
  await first;
});

test('cancel aborts the request and a late answer is discarded', async () => {
  const { ask, calls } = fakeAsk();
  const session = createTutorSession({ ask });
  const sending = session.send(() => ({}), 'q');

  session.cancel();
  assert.equal(calls[0].signal.aborted, true);
  assert.equal(session.getSnapshot().status, 'idle');

  calls[0].resolve(answer('too late'));
  assert.equal((await sending).reason, 'stale');
  assert.equal(session.getSnapshot().status, 'idle');
  assert.equal(session.getSnapshot().result, null);
});

test('reset discards an in-flight answer and clears the conversation', async () => {
  const { ask, calls } = fakeAsk();
  const session = createTutorSession({ ask });
  const first = session.send(() => ({}), 'one');
  calls[0].resolve(answer('a1'));
  await first;

  const second = session.send(() => ({}), 'two');
  session.reset();
  calls[1].resolve(answer('stale'));
  await second;

  const snapshot = session.getSnapshot();
  assert.equal(snapshot.status, 'idle');
  assert.deepEqual(snapshot.history, []);
  assert.equal(snapshot.result, null);
});

test('a stale answer never overwrites a newer request', async () => {
  const { ask, calls } = fakeAsk();
  const session = createTutorSession({ ask });
  const first = session.send(() => ({}), 'old');
  session.cancel();
  const second = session.send(() => ({}), 'new');

  calls[1].resolve(answer('new answer'));
  calls[0].resolve(answer('old answer'));
  await Promise.all([first, second]);

  assert.equal(session.getSnapshot().result.answer, 'new answer');
});

test('a failure becomes an error state and a retry works', async () => {
  const { ask, calls } = fakeAsk();
  const session = createTutorSession({ ask, describeError: (error) => ({ kind: 'server', message: error.message }) });
  const failing = session.send(() => ({}), 'q');
  calls[0].reject(new Error('Model unavailable'));

  assert.equal((await failing).reason, 'error');
  assert.deepEqual(session.getSnapshot().error, { kind: 'server', message: 'Model unavailable' });
  assert.deepEqual(session.getSnapshot().history, []);

  const retry = session.send(() => ({}), 'q');
  calls[1].resolve(answer('fine'));
  await retry;
  assert.equal(session.getSnapshot().status, 'success');
  assert.equal(session.getSnapshot().error, null);
});

test('handoff and clarify results do not become conversation context', async () => {
  const { ask, calls } = fakeAsk();
  const session = createTutorSession({ ask });
  const sending = session.send(() => ({}), 'quiz me');
  calls[0].resolve({ outcome: 'handoff', handoff: { kind: 'quiz' } });
  await sending;

  assert.equal(session.getSnapshot().status, 'success');
  assert.deepEqual(session.getSnapshot().history, []);
});

test('history is bounded', async () => {
  const { ask, calls } = fakeAsk();
  const session = createTutorSession({ ask });

  for (let index = 0; index < 6; index += 1) {
    const sending = session.send(() => ({}), `q${index}`);
    calls[index].resolve(answer(`a${index}`));
    await sending;
  }

  assert.equal(session.getSnapshot().history.length, 6);
  assert.equal(session.getSnapshot().history.at(-1).content, 'a5');
});

test('dispose (unmount) aborts the request and is reversible for StrictMode', async () => {
  const { ask, calls } = fakeAsk();
  const session = createTutorSession({ ask });
  const sending = session.send(() => ({}), 'q');

  session.dispose();
  calls[0].resolve(answer('discarded'));
  await sending;
  assert.equal(session.getSnapshot().status, 'idle');

  const again = session.send(() => ({}), 'q2');
  calls[1].resolve(answer('works'));
  await again;
  assert.equal(session.getSnapshot().result.answer, 'works');
});

test('subscribers are notified and can unsubscribe', async () => {
  const { ask, calls } = fakeAsk();
  const session = createTutorSession({ ask });
  let notifications = 0;
  const unsubscribe = session.subscribe(() => (notifications += 1));
  const sending = session.send(() => ({}), 'q');
  calls[0].resolve(answer('ok'));
  await sending;
  assert.equal(notifications, 2);

  unsubscribe();
  session.reset();
  assert.equal(notifications, 2);
});
