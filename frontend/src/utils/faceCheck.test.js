import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countFaces } from './faceCheck.js';

describe('countFaces', () => {
  it('is unavailable without a FaceDetector', async () => {
    assert.deepEqual(await countFaces({}, { Detector: undefined }), { status: 'unavailable', faces: 0 });
  });
  it('returns only a count (no boxes, landmarks or identity)', async () => {
    class Detector { async detect() { return [{ boundingBox: {}, landmarks: [] }, { boundingBox: {}, landmarks: [] }]; } }
    const result = await countFaces({}, { Detector });
    assert.deepEqual(result, { status: 'done', faces: 2 });
  });
  it('reports zero faces', async () => {
    class Detector { async detect() { return []; } }
    assert.deepEqual(await countFaces({}, { Detector }), { status: 'done', faces: 0 });
  });
  it('fails safely when the detector throws or returns junk', async () => {
    class Boom { async detect() { throw new Error('nope'); } }
    class Junk { async detect() { return 'x'; } }
    class BadCtor { constructor() { throw new Error('no'); } }
    assert.equal((await countFaces({}, { Detector: Boom })).status, 'failed');
    assert.deepEqual(await countFaces({}, { Detector: Junk }), { status: 'done', faces: 0 });
    assert.equal((await countFaces({}, { Detector: BadCtor })).status, 'failed');
  });
});
