import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AVATAR_COLORS,
  AVATAR_DATA_URL_PREFIX,
  AVATAR_MAX_DATA_URL_LENGTH,
  AVATAR_MAX_FILE_BYTES,
  DEFAULT_AVATAR_COLOR,
  getAvatarColorClasses,
  getSquareCrop,
  isValidAvatarDataUrl,
  normalizeAvatarColor,
  sniffImageType,
  validateAvatarFile
} from './avatar.js';

const pad = (bytes) => Uint8Array.from([...bytes, ...new Array(Math.max(0, 12 - bytes.length)).fill(0)]);
const JPEG = pad([0xff, 0xd8, 0xff, 0xe0]);
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);

describe('validateAvatarFile', () => {
  it('accepts JPEG, PNG and WebP within the size limit', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      assert.deepEqual(validateAvatarFile({ type, size: 1000 }), { ok: true });
    }
    assert.deepEqual(validateAvatarFile({ type: 'image/png', size: AVATAR_MAX_FILE_BYTES }), { ok: true });
  });

  it('rejects missing, empty, oversized and unsupported files with a readable message', () => {
    assert.equal(validateAvatarFile(null).ok, false);
    assert.equal(validateAvatarFile({ type: 'image/png', size: 0 }).ok, false);
    assert.match(validateAvatarFile({ type: 'image/png', size: AVATAR_MAX_FILE_BYTES + 1 }).error, /larger than 2 MB/);
    assert.match(validateAvatarFile({ type: 'image/gif', size: 10 }).error, /JPEG, PNG or WebP/);
    assert.equal(validateAvatarFile({ type: 'image/svg+xml', size: 10 }).ok, false, 'SVG can carry scripts');
    assert.equal(validateAvatarFile({ type: 'application/pdf', size: 10 }).ok, false);
    assert.equal(validateAvatarFile({ type: '', size: 10 }).ok, false);
  });
});

describe('sniffImageType', () => {
  it('identifies real images from their first bytes', () => {
    assert.equal(sniffImageType(JPEG), 'image/jpeg');
    assert.equal(sniffImageType(PNG), 'image/png');
    assert.equal(sniffImageType(WEBP), 'image/webp');
  });

  it('rejects renamed non-images, RIFF files that are not WebP, and short input', () => {
    assert.equal(sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
    assert.equal(sniffImageType(new TextEncoder().encode('%PDF-1.7 fake content')), null);
    assert.equal(sniffImageType(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45])), null);
    assert.equal(sniffImageType(Uint8Array.from([0xff, 0xd8])), null);
    assert.equal(sniffImageType(null), null);
  });
});

describe('isValidAvatarDataUrl', () => {
  const good = `${AVATAR_DATA_URL_PREFIX}/9j/4AAQSkZJRgABAQ==`;

  it('accepts a small base64 JPEG data URL', () => {
    assert.equal(isValidAvatarDataUrl(good), true);
  });

  it('rejects other schemes, other types, oversized payloads and junk', () => {
    assert.equal(isValidAvatarDataUrl('https://example.com/a.jpg'), false);
    assert.equal(isValidAvatarDataUrl('javascript:alert(1)'), false);
    assert.equal(isValidAvatarDataUrl('data:image/svg+xml;base64,PHN2Zz4='), false);
    assert.equal(isValidAvatarDataUrl('data:image/png;base64,AAAA'), false);
    assert.equal(isValidAvatarDataUrl(`${AVATAR_DATA_URL_PREFIX}not base64!!`), false);
    assert.equal(isValidAvatarDataUrl(`${AVATAR_DATA_URL_PREFIX}`), false);
    assert.equal(isValidAvatarDataUrl(`${AVATAR_DATA_URL_PREFIX}${'A'.repeat(AVATAR_MAX_DATA_URL_LENGTH)}`), false);
    assert.equal(isValidAvatarDataUrl(null), false);
    assert.equal(isValidAvatarDataUrl(42), false);
    assert.equal(isValidAvatarDataUrl({}), false);
  });
});

describe('avatar colours', () => {
  it('falls back to the default for unknown values', () => {
    assert.equal(normalizeAvatarColor('sunset'), 'sunset');
    for (const bad of ['neon', '', null, undefined, 3, {}, 'from-red-500']) {
      assert.equal(normalizeAvatarColor(bad), DEFAULT_AVATAR_COLOR);
    }
  });

  it('every palette entry has a unique key and gradient classes; unknown keys still get classes', () => {
    assert.equal(new Set(AVATAR_COLORS.map((color) => color.key)).size, AVATAR_COLORS.length);
    for (const color of AVATAR_COLORS) {
      assert.match(getAvatarColorClasses(color.key), /^from-/);
    }
    assert.equal(getAvatarColorClasses('bogus'), getAvatarColorClasses(DEFAULT_AVATAR_COLOR));
  });
});

describe('getSquareCrop', () => {
  it('crops the centre of landscape and portrait images', () => {
    assert.deepEqual(getSquareCrop(400, 200), { sx: 100, sy: 0, size: 200 });
    assert.deepEqual(getSquareCrop(200, 400), { sx: 0, sy: 100, size: 200 });
    assert.deepEqual(getSquareCrop(300, 300), { sx: 0, sy: 0, size: 300 });
    assert.deepEqual(getSquareCrop(5, 8), { sx: 0, sy: 1, size: 5 });
  });
});
