/**
 * Pure helpers for the camera feature. Nothing here touches the camera, the network or storage.
 *
 * The feature is built around ONE still photo that the student chooses to take or pick and then explicitly sends.
 * HIMI never records video, never uploads frames continuously and never keeps the photo.
 */

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
/** Largest file read from disk. Larger photos are rejected before any work is done. */
export const MAX_FILE_BYTES = 12 * 1024 * 1024;
/** Photos are shrunk to this many pixels on the longest side before sending. */
export const MAX_DIMENSION = 1280;
export const JPEG_QUALITY = 0.82;
/** The server accepts 3.5 MB; stay safely below it. */
export const MAX_SEND_BYTES = 3_300_000;
export const MAX_QUESTION_CHARS = 500;
export const CAMERA_TASKS = ['explain', 'transcribe', 'question'];

const KINDS = ['notes', 'textbook', 'diagram', 'code', 'problem', 'other', 'not_study_material'];
const LEGIBILITY = ['clear', 'partly_unclear', 'unreadable'];

export class InvalidCameraResponseError extends Error {
  constructor(message = 'The photo analysis was not in the expected format.') {
    super(message);
    this.name = 'InvalidCameraResponseError';
  }
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const line = (value, max) => {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return text ? text.slice(0, max) : null;
};
const strings = (raw, max, limit) => (Array.isArray(raw) ? raw : []).flatMap((item) => (line(item, max) ? [line(item, max)] : [])).slice(0, limit);

/** @returns {null | 'empty' | 'type' | 'size'} */
export function validateImageFile(file) {
  if (!file || typeof file.size !== 'number' || file.size === 0) {
    return 'empty';
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'type';
  }

  return file.size > MAX_FILE_BYTES ? 'size' : null;
}

/** Scale `width` x `height` down so the longest side is at most `max`. Never scales up. */
export function fitWithin(width, height, max = MAX_DIMENSION) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const longest = Math.max(w, h);

  if (longest <= max) {
    return { width: w, height: h };
  }

  const scale = max / longest;
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** Split a `data:image/...;base64,` URL into its type and payload. Returns null for anything else. */
export function parseImageDataUrl(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(dataUrl ?? ''));
  return match ? { mimeType: match[1], base64: match[2] } : null;
}

/** Decoded size of a base64 string. */
export function base64ByteLength(base64) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** @returns {null | 'empty' | 'question_required' | 'question_too_long' | 'too_large'} */
export function validateCameraInput({ task, question, imageBase64 }) {
  if (!imageBase64) {
    return 'empty';
  }

  if (base64ByteLength(imageBase64) > MAX_SEND_BYTES) {
    return 'too_large';
  }

  const text = (question ?? '').trim();

  if (task === 'question' && !text) {
    return 'question_required';
  }

  return text.length > MAX_QUESTION_CHARS ? 'question_too_long' : null;
}

export function buildCameraRequest({ imageBase64, mimeType, task, question, subject, language, helpMode }) {
  const request = { image: imageBase64, mimeType, task, language, helpMode };
  const text = (question ?? '').trim().slice(0, MAX_QUESTION_CHARS);

  if (text) {
    request.question = text;
  }

  if (subject) {
    request.subject = subject;
  }

  return request;
}

/**
 * Validate a `/api/camera/analyze` payload. A response that does not confirm the photo was not retained is
 * rejected, so the screen can never claim something the server did not say.
 */
export function parseCameraResponse(data) {
  if (!isObject(data) || !CAMERA_TASKS.includes(data.task) || data.imageRetained !== false) {
    throw new InvalidCameraResponseError();
  }

  const explanation = typeof data.explanation === 'string' ? data.explanation.trim().slice(0, 4000) : '';

  if (!explanation) {
    throw new InvalidCameraResponseError('Missing explanation.');
  }

  const kind = KINDS.includes(data.kind) ? data.kind : 'other';
  const notStudy = kind === 'not_study_material';

  return {
    requestId: line(data.requestId, 40) ?? '',
    task: data.task,
    language: data.language === 'te' ? 'te' : 'en',
    title: line(data.title, 120) ?? '',
    kind,
    legibility: LEGIBILITY.includes(data.legibility) ? data.legibility : 'partly_unclear',
    whatIsShown: notStudy ? '' : line(data.whatIsShown, 600) ?? '',
    extractedText: notStudy || typeof data.extractedText !== 'string' || !data.extractedText.trim() ? null : data.extractedText.trim().slice(0, 4000),
    explanation,
    keyPoints: notStudy ? [] : strings(data.keyPoints, 300, 6),
    followUps: notStudy ? [] : strings(data.followUps, 160, 3),
    review: isObject(data.review) ? { passed: data.review.passed === true, issues: strings(data.review.issues, 300, 6) } : null,
    modelCalls: Number.isFinite(data.modelCalls) ? Math.max(0, Math.round(data.modelCalls)) : 0
  };
}

/**
 * Map a getUserMedia failure to a translation key and whether trying again can help.
 * The key lives in the i18n dictionaries under `camera.error.*`.
 */
export function describeMediaError(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return { key: 'camera.error.denied', retryable: false };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return { key: 'camera.error.notFound', retryable: true };
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return { key: 'camera.error.busy', retryable: true };
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return { key: 'camera.error.constraints', retryable: true };
    default:
      return { key: 'camera.error.generic', retryable: true };
  }
}

/** Whether the browser can open a camera at all, and if not, why. */
export function getCameraSupport(scope = globalThis) {
  if (!scope?.navigator?.mediaDevices?.getUserMedia) {
    return { supported: false, reason: scope?.isSecureContext === false ? 'insecure' : 'unsupported' };
  }

  if (scope.isSecureContext === false) {
    return { supported: false, reason: 'insecure' };
  }

  return { supported: true, reason: null };
}

export const isFaceDetectorSupported = (scope = globalThis) => typeof scope?.FaceDetector === 'function';

/**
 * Honest status of every perception capability, from what this browser actually offers.
 * - `tested`: exercised by automated tests of the real code path.
 * - `untested_hardware`: implemented, but no real camera or detector hardware was used to test it.
 * - `unavailable`: not provided (with the reason shown to the student).
 */
export function describeCapabilities({ cameraSupported, faceDetectorSupported }) {
  return [
    { id: 'upload', state: 'tested' },
    { id: 'explain', state: 'tested' },
    { id: 'preview', state: cameraSupported ? 'untested_hardware' : 'unavailable' },
    { id: 'capture', state: cameraSupported ? 'untested_hardware' : 'unavailable' },
    { id: 'face', state: faceDetectorSupported ? 'untested_hardware' : 'unavailable' },
    { id: 'checkin', state: 'tested' },
    { id: 'emotion', state: 'unavailable' },
    { id: 'attention', state: 'unavailable' },
    { id: 'gestures', state: 'unavailable' }
  ];
}

/** Self-report check-in: suggestions are fixed rules the student can see, never inferred from the camera. */
export const CHECK_IN_OPTIONS = ['focused', 'distracted', 'confused', 'tired'];

export const CHECK_IN_SUGGESTIONS = {
  focused: [{ to: '/quiz', key: 'camera.checkin.tip.quiz' }],
  distracted: [{ to: null, key: 'camera.checkin.tip.break' }, { to: '/mentor', key: 'camera.checkin.tip.smallStep' }],
  confused: [{ to: '/mentor', key: 'camera.checkin.tip.mentor' }, { to: '/diagrams', key: 'camera.checkin.tip.diagram' }],
  tired: [{ to: null, key: 'camera.checkin.tip.rest' }, { to: '/notes', key: 'camera.checkin.tip.notes' }]
};

export const isCheckIn = (value) => CHECK_IN_OPTIONS.includes(value);
