import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { describe, it } from 'node:test';
import {
  base64ByteLength,
  buildCameraRequest,
  CHECK_IN_OPTIONS,
  CHECK_IN_SUGGESTIONS,
  describeCapabilities,
  describeMediaError,
  fitWithin,
  getCameraSupport,
  InvalidCameraResponseError,
  isFaceDetectorSupported,
  MAX_DIMENSION,
  MAX_FILE_BYTES,
  MAX_SEND_BYTES,
  parseCameraResponse,
  parseImageDataUrl,
  validateCameraInput,
  validateImageFile
} from './camera.js';
import en from '../i18n/en.js';

const good = (over = {}) => ({
  requestId: 'r1', task: 'explain', language: 'en', title: 'Process states', kind: 'diagram', legibility: 'clear',
  whatIsShown: 'A diagram.', extractedText: 'Ready -> Running', explanation: 'It shows states.', keyPoints: ['One', 'Two'],
  followUps: ['Why?'], imageRetained: false, review: { passed: true, issues: [] }, modelCalls: 1, ...over
});

describe('validateImageFile', () => {
  it('accepts jpeg, png and webp', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.equal(validateImageFile({ type, size: 1000 }), null);
  });
  it('rejects other types, empty and oversized files', () => {
    assert.equal(validateImageFile({ type: 'image/svg+xml', size: 10 }), 'type');
    assert.equal(validateImageFile({ type: 'image/gif', size: 10 }), 'type');
    assert.equal(validateImageFile({ type: 'application/pdf', size: 10 }), 'type');
    assert.equal(validateImageFile({ type: 'image/png', size: 0 }), 'empty');
    assert.equal(validateImageFile(null), 'empty');
    assert.equal(validateImageFile({ type: 'image/png', size: MAX_FILE_BYTES + 1 }), 'size');
  });
});

describe('fitWithin', () => {
  it('keeps small images as they are', () => assert.deepEqual(fitWithin(640, 480), { width: 640, height: 480 }));
  it('scales the longest side down and keeps the aspect ratio', () => {
    assert.deepEqual(fitWithin(4000, 3000), { width: MAX_DIMENSION, height: 960 });
    assert.deepEqual(fitWithin(3000, 4000), { width: 960, height: MAX_DIMENSION });
  });
  it('never returns zero or fractional sizes', () => {
    const { width, height } = fitWithin(100000, 3);
    assert.ok(Number.isInteger(width) && Number.isInteger(height) && width >= 1 && height >= 1);
    assert.deepEqual(fitWithin(0, 0), { width: 1, height: 1 });
  });
});

describe('parseImageDataUrl', () => {
  it('splits a valid data URL', () => assert.deepEqual(parseImageDataUrl('data:image/jpeg;base64,QUJD'), { mimeType: 'image/jpeg', base64: 'QUJD' }));
  it('rejects other schemes and types', () => {
    for (const value of ['data:image/svg+xml;base64,QUJD', 'data:text/html;base64,QUJD', 'http://x/y.png', 'data:image/png;base64,', 'data:image/png;base64,@@@', '', null]) {
      assert.equal(parseImageDataUrl(value), null, String(value));
    }
  });
});

describe('base64ByteLength', () => {
  it('matches the real decoded size', () => {
    for (const text of ['', 'a', 'ab', 'abc', 'abcd', 'hello world']) {
      assert.equal(base64ByteLength(Buffer.from(text).toString('base64')), text.length);
    }
  });
});

describe('validateCameraInput', () => {
  const image = Buffer.from('x'.repeat(100)).toString('base64');
  it('needs an image', () => assert.equal(validateCameraInput({ task: 'explain', imageBase64: '' }), 'empty'));
  it('accepts an explain request without a question', () => assert.equal(validateCameraInput({ task: 'explain', imageBase64: image }), null));
  it('requires a question for the question task', () => {
    assert.equal(validateCameraInput({ task: 'question', question: '   ', imageBase64: image }), 'question_required');
    assert.equal(validateCameraInput({ task: 'question', question: 'What is this?', imageBase64: image }), null);
  });
  it('rejects long questions and oversized images', () => {
    assert.equal(validateCameraInput({ task: 'explain', question: 'x'.repeat(501), imageBase64: image }), 'question_too_long');
    assert.equal(validateCameraInput({ task: 'explain', imageBase64: 'A'.repeat(Math.ceil((MAX_SEND_BYTES * 4) / 3) + 8) }), 'too_large');
  });
});

describe('buildCameraRequest', () => {
  it('sends only what the server accepts and trims the question', () => {
    const request = buildCameraRequest({ imageBase64: 'QUJD', mimeType: 'image/jpeg', task: 'question', question: '  What?  ', subject: 'Algorithms', language: 'te', helpMode: 'hint' });
    assert.deepEqual(request, { image: 'QUJD', mimeType: 'image/jpeg', task: 'question', language: 'te', helpMode: 'hint', question: 'What?', subject: 'Algorithms' });
  });
  it('omits empty optional fields', () => {
    const request = buildCameraRequest({ imageBase64: 'QUJD', mimeType: 'image/png', task: 'explain', question: '  ', subject: '', language: 'en', helpMode: 'guided' });
    assert.equal('question' in request, false);
    assert.equal('subject' in request, false);
  });
});

describe('parseCameraResponse', () => {
  it('accepts a valid response', () => {
    const result = parseCameraResponse(good());
    assert.equal(result.kind, 'diagram');
    assert.deepEqual(result.keyPoints, ['One', 'Two']);
  });
  it('rejects a response that does not confirm the photo was not kept', () => {
    assert.throws(() => parseCameraResponse(good({ imageRetained: true })), InvalidCameraResponseError);
    assert.throws(() => parseCameraResponse({ ...good(), imageRetained: undefined }), InvalidCameraResponseError);
  });
  it('rejects junk and missing explanations', () => {
    for (const value of [null, 'x', [], {}, good({ explanation: '  ' }), good({ task: 'identify' })]) {
      assert.throws(() => parseCameraResponse(value), InvalidCameraResponseError);
    }
  });
  it('shows nothing but the refusal for non-study photos', () => {
    const result = parseCameraResponse(good({ kind: 'not_study_material', whatIsShown: 'A person smiling', extractedText: 'NAME', keyPoints: ['x'], followUps: ['y'] }));
    assert.equal(result.whatIsShown, '');
    assert.equal(result.extractedText, null);
    assert.deepEqual([result.keyPoints, result.followUps], [[], []]);
  });
  it('falls back safely for unknown enums and drops junk list entries', () => {
    const result = parseCameraResponse(good({ kind: 'selfie', legibility: 'perfect', keyPoints: ['ok', 5, null, ''], extractedText: '   ' }));
    assert.equal(result.kind, 'other');
    assert.equal(result.legibility, 'partly_unclear');
    assert.deepEqual(result.keyPoints, ['ok']);
    assert.equal(result.extractedText, null);
  });
  it('keeps hostile text as plain strings (the UI renders text, never markup)', () => {
    assert.equal(parseCameraResponse(good({ title: '<img src=x onerror=alert(1)>' })).title, '<img src=x onerror=alert(1)>');
  });
});

describe('describeMediaError', () => {
  it('maps the standard errors', () => {
    assert.deepEqual(describeMediaError({ name: 'NotAllowedError' }), { key: 'camera.error.denied', retryable: false });
    assert.equal(describeMediaError({ name: 'NotFoundError' }).key, 'camera.error.notFound');
    assert.equal(describeMediaError({ name: 'NotReadableError' }).key, 'camera.error.busy');
    assert.equal(describeMediaError({ name: 'OverconstrainedError' }).key, 'camera.error.constraints');
    assert.equal(describeMediaError(new Error('x')).key, 'camera.error.generic');
    assert.equal(describeMediaError(undefined).key, 'camera.error.generic');
  });
  it('only uses keys that exist in the English dictionary', () => {
    for (const name of ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'OverconstrainedError', 'Other']) {
      assert.ok(en[describeMediaError({ name }).key]);
    }
  });
});

describe('support detection', () => {
  it('needs getUserMedia and a secure context', () => {
    assert.deepEqual(getCameraSupport({ navigator: { mediaDevices: { getUserMedia() {} } }, isSecureContext: true }), { supported: true, reason: null });
    assert.deepEqual(getCameraSupport({ navigator: {} }), { supported: false, reason: 'unsupported' });
    assert.equal(getCameraSupport({ navigator: { mediaDevices: { getUserMedia() {} } }, isSecureContext: false }).reason, 'insecure');
    assert.equal(getCameraSupport(undefined).supported, false);
  });
  it('detects FaceDetector', () => {
    assert.equal(isFaceDetectorSupported({ FaceDetector: class {} }), true);
    assert.equal(isFaceDetectorSupported({}), false);
  });
});

describe('describeCapabilities', () => {
  const byId = (list) => Object.fromEntries(list.map((item) => [item.id, item.state]));
  it('never calls hardware features tested, and never offers emotion, attention or gestures', () => {
    const states = byId(describeCapabilities({ cameraSupported: true, faceDetectorSupported: true }));
    assert.equal(states.preview, 'untested_hardware');
    assert.equal(states.capture, 'untested_hardware');
    assert.equal(states.face, 'untested_hardware');
    assert.deepEqual([states.emotion, states.attention, states.gestures], ['unavailable', 'unavailable', 'unavailable']);
  });
  it('reports unsupported browsers as unavailable', () => {
    const states = byId(describeCapabilities({ cameraSupported: false, faceDetectorSupported: false }));
    assert.deepEqual([states.preview, states.capture, states.face], ['unavailable', 'unavailable', 'unavailable']);
    assert.equal(states.upload, 'tested');
  });
});

describe('check-in suggestions', () => {
  it('has a suggestion list for every option, with translated text', () => {
    for (const option of CHECK_IN_OPTIONS) {
      assert.ok(CHECK_IN_SUGGESTIONS[option].length > 0);
      for (const tip of CHECK_IN_SUGGESTIONS[option]) assert.ok(en[tip.key], tip.key);
      assert.ok(en[`camera.checkin.${option}`], option);
    }
  });
});
