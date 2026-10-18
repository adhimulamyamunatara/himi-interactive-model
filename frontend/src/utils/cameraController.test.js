import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createCameraController } from './cameraController.js';

function fakeStream() {
  const tracks = [{ stopped: 0, stop() { this.stopped += 1; } }, { stopped: 0, stop() { this.stopped += 1; } }];
  return { tracks, getTracks: () => tracks };
}
const stopped = (stream) => stream.tracks.every((track) => track.stopped >= 1);

describe('createCameraController', () => {
  it('does nothing until start() is called', () => {
    let calls = 0;
    const controller = createCameraController({ getUserMedia: async () => { calls += 1; return fakeStream(); } });
    assert.equal(calls, 0);
    assert.equal(controller.getSnapshot().status, 'idle');
  });

  it('goes live and exposes the stream', async () => {
    const stream = fakeStream();
    const controller = createCameraController({ getUserMedia: async () => stream });
    assert.equal(await controller.start(), true);
    assert.equal(controller.getSnapshot().status, 'live');
    assert.equal(controller.getSnapshot().stream, stream);
  });

  it('requests video only, never audio', async () => {
    let constraints;
    const controller = createCameraController({ getUserMedia: async (c) => { constraints = c; return fakeStream(); } });
    await controller.start();
    assert.equal(constraints.audio, false);
    assert.ok(constraints.video);
  });

  it('stop() stops every track and returns to idle', async () => {
    const stream = fakeStream();
    const controller = createCameraController({ getUserMedia: async () => stream });
    await controller.start();
    controller.stop();
    assert.ok(stopped(stream));
    assert.deepEqual([controller.getSnapshot().status, controller.getSnapshot().stream], ['idle', null]);
  });

  it('stop() is safe to call repeatedly and when nothing is open', async () => {
    const controller = createCameraController({ getUserMedia: async () => fakeStream() });
    controller.stop();
    controller.stop();
    await controller.start();
    controller.stop();
    controller.stop();
    assert.equal(controller.getSnapshot().status, 'idle');
  });

  it('a stream that arrives after stop() is stopped immediately and never shown', async () => {
    const stream = fakeStream();
    let release;
    const controller = createCameraController({ getUserMedia: () => new Promise((resolve) => { release = () => resolve(stream); }) });
    const pending = controller.start();
    assert.equal(controller.getSnapshot().status, 'starting');
    controller.stop();
    release();
    assert.equal(await pending, false);
    assert.ok(stopped(stream), 'the late stream must be stopped');
    assert.equal(controller.getSnapshot().status, 'idle');
    assert.equal(controller.getSnapshot().stream, null);
  });

  it('a second start() while starting or live is ignored (one stream only)', async () => {
    let calls = 0;
    const controller = createCameraController({ getUserMedia: async () => { calls += 1; return fakeStream(); } });
    const first = controller.start();
    assert.equal(await controller.start(), false);
    await first;
    assert.equal(await controller.start(), false);
    assert.equal(calls, 1);
  });

  it('can start again after stop', async () => {
    const controller = createCameraController({ getUserMedia: async () => fakeStream() });
    await controller.start();
    controller.stop();
    assert.equal(await controller.start(), true);
  });

  it('turns permission and device errors into safe keys', async () => {
    for (const [name, key, retryable] of [['NotAllowedError', 'camera.error.denied', false], ['NotFoundError', 'camera.error.notFound', true], ['NotReadableError', 'camera.error.busy', true]]) {
      const controller = createCameraController({ getUserMedia: async () => { throw Object.assign(new Error('secret device detail'), { name }); } });
      assert.equal(await controller.start(), false);
      const snapshot = controller.getSnapshot();
      assert.deepEqual([snapshot.status, snapshot.errorKey, snapshot.retryable], ['error', key, retryable]);
      assert.ok(!JSON.stringify(snapshot).includes('secret device detail'));
    }
  });

  it('an error from a stopped attempt does not overwrite the idle state', async () => {
    let fail;
    const controller = createCameraController({ getUserMedia: () => new Promise((_, reject) => { fail = () => reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })); }) });
    const pending = controller.start();
    controller.stop();
    fail();
    await pending;
    assert.equal(controller.getSnapshot().status, 'idle');
  });

  it('can retry after an error', async () => {
    let attempt = 0;
    const controller = createCameraController({ getUserMedia: async () => { attempt += 1; if (attempt === 1) throw Object.assign(new Error('x'), { name: 'NotFoundError' }); return fakeStream(); } });
    await controller.start();
    assert.equal(controller.getSnapshot().status, 'error');
    assert.equal(await controller.start(), true);
    assert.equal(controller.getSnapshot().errorKey, null);
  });

  it('notifies subscribers and stops notifying after unsubscribe', async () => {
    const controller = createCameraController({ getUserMedia: async () => fakeStream() });
    let count = 0;
    const off = controller.subscribe(() => { count += 1; });
    await controller.start();
    assert.ok(count >= 2);
    off();
    const before = count;
    controller.stop();
    assert.equal(count, before);
  });

  it('treats a missing stream as a device error', async () => {
    const controller = createCameraController({ getUserMedia: async () => null });
    await controller.start();
    assert.equal(controller.getSnapshot().errorKey, 'camera.error.notFound');
  });
});
