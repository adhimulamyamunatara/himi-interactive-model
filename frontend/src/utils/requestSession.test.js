import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequestSession } from './requestSession.js';

function fakeAsk() {
  const calls = [];
  const ask = (request, { signal }) =>
    new Promise((resolve, reject) => {
      calls.push({ request, signal, resolve, reject });
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { code: 'ERR_CANCELED' })));
    });
  return { ask, calls };
}

test('a successful request stores the result', async () => {
  const { ask, calls } = fakeAsk();
  const session = createRequestSession({ ask });
  const sending = session.send({ q: 1 });
  assert.equal(session.getSnapshot().status, 'loading');
  calls[0].resolve({ ok: true });
  assert.deepEqual(await sending, { started: true });
  assert.deepEqual(session.getSnapshot(), { status: 'success', result: { ok: true }, error: null });
  assert.deepEqual(calls[0].request, { q: 1 });
});

test('a second send while loading is ignored', async () => {
  const { ask, calls } = fakeAsk();
  const session = createRequestSession({ ask });
  const first = session.send({});
  assert.deepEqual(await session.send({}), { started: false, reason: 'busy' });
  assert.equal(calls.length, 1);
  calls[0].resolve(1);
  await first;
});

test('cancel aborts the request and a late result is discarded', async () => {
  const { ask, calls } = fakeAsk();
  const session = createRequestSession({ ask });
  const sending = session.send({});
  session.cancel();
  assert.equal(calls[0].signal.aborted, true);
  calls[0].resolve('late');
  assert.equal((await sending).reason, 'stale');
  assert.equal(session.getSnapshot().status, 'idle');
  assert.equal(session.getSnapshot().result, null);
});

test('reset discards an in-flight result', async () => {
  const { ask, calls } = fakeAsk();
  const session = createRequestSession({ ask });
  const sending = session.send({});
  session.reset();
  calls[0].resolve('stale');
  await sending;
  assert.equal(session.getSnapshot().status, 'idle');
});

test('an older request can never overwrite a newer one', async () => {
  const { ask, calls } = fakeAsk();
  const session = createRequestSession({ ask });
  const first = session.send({});
  session.cancel();
  const second = session.send({});
  calls[1].resolve('new');
  calls[0].resolve('old');
  await Promise.all([first, second]);
  assert.equal(session.getSnapshot().result, 'new');
});

test('failures become an error state, and retry works', async () => {
  const { ask, calls } = fakeAsk();
  const session = createRequestSession({ ask, describeError: (error) => ({ kind: 'server', message: error.message }) });
  const failing = session.send({});
  calls[0].reject(new Error('Model unavailable'));
  assert.equal((await failing).reason, 'error');
  assert.deepEqual(session.getSnapshot().error, { kind: 'server', message: 'Model unavailable' });

  const retry = session.send({});
  calls[1].resolve('fine');
  await retry;
  assert.equal(session.getSnapshot().status, 'success');
  assert.equal(session.getSnapshot().error, null);
});

test('dispose aborts and stays reusable for StrictMode remounts', async () => {
  const { ask, calls } = fakeAsk();
  const session = createRequestSession({ ask });
  const sending = session.send({});
  session.dispose();
  calls[0].resolve('discarded');
  await sending;
  assert.equal(session.getSnapshot().status, 'idle');

  const again = session.send({});
  calls[1].resolve('works');
  await again;
  assert.equal(session.getSnapshot().result, 'works');
});

test('subscribers are notified and can unsubscribe', async () => {
  const { ask, calls } = fakeAsk();
  const session = createRequestSession({ ask });
  let count = 0;
  const unsubscribe = session.subscribe(() => (count += 1));
  const sending = session.send({});
  calls[0].resolve(1);
  await sending;
  assert.equal(count, 2);
  unsubscribe();
  session.reset();
  assert.equal(count, 2);
});
