/**
 * Avatar rules that do not depend on the browser, so they can be unit tested.
 *
 * A profile photo is never stored as the uploaded file. It is centre-cropped and downscaled to a small JPEG
 * (see `avatarImage.js`) so the saved data URL stays a few kilobytes and localStorage is not filled up.
 */

export const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const AVATAR_OUTPUT_SIZE = 160;
export const AVATAR_JPEG_QUALITY = 0.85;
/** Upper bound for the stored data URL (a 160x160 JPEG is normally 5-15 KB). */
export const AVATAR_MAX_DATA_URL_LENGTH = 60000;
export const AVATAR_DATA_URL_PREFIX = 'data:image/jpeg;base64,';

/** Gradient classes are written out in full so Tailwind can see them. */
export const AVATAR_COLORS = [
  { key: 'ocean', label: 'Ocean', classes: 'from-blue-600 via-indigo-600 to-cyan-500' },
  { key: 'sunset', label: 'Sunset', classes: 'from-orange-600 via-rose-600 to-pink-600' },
  { key: 'forest', label: 'Forest', classes: 'from-emerald-700 via-teal-600 to-emerald-500' },
  { key: 'violet', label: 'Violet', classes: 'from-violet-700 via-violet-600 to-indigo-500' },
  { key: 'slate', label: 'Slate', classes: 'from-slate-800 via-slate-700 to-slate-500' }
];

export const DEFAULT_AVATAR_COLOR = 'ocean';

export function isAvatarColor(key) {
  return AVATAR_COLORS.some((color) => color.key === key);
}

/** Unknown or missing colours fall back to the default instead of breaking the avatar. */
export function normalizeAvatarColor(key) {
  return isAvatarColor(key) ? key : DEFAULT_AVATAR_COLOR;
}

export function getAvatarColorClasses(key) {
  return AVATAR_COLORS.find((color) => color.key === normalizeAvatarColor(key)).classes;
}

const BASE64_BODY = /^[A-Za-z0-9+/]+={0,2}$/;

/** Only a small base64 JPEG produced by this app is accepted from storage. Anything else is dropped. */
export function isValidAvatarDataUrl(value) {
  if (typeof value !== 'string') {
    return false;
  }

  if (!value.startsWith(AVATAR_DATA_URL_PREFIX) || value.length > AVATAR_MAX_DATA_URL_LENGTH) {
    return false;
  }

  return BASE64_BODY.test(value.slice(AVATAR_DATA_URL_PREFIX.length));
}

const startsWith = (bytes, signature, offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte);

/**
 * Identify an image from its first bytes rather than trusting the file name or declared type.
 *
 * @param {Uint8Array} bytes at least the first 12 bytes of the file
 * @returns {string | null} a MIME type from `AVATAR_ALLOWED_TYPES`, or null
 */
export function sniffImageType(bytes) {
  if (!bytes || bytes.length < 12) {
    return null;
  }

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }

  // "RIFF" .... "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp';
  }

  return null;
}

/**
 * Cheap checks on the picked file before reading it.
 *
 * @param {{ type?: string, size?: number } | null | undefined} file
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateAvatarFile(file) {
  if (!file || typeof file.size !== 'number') {
    return { ok: false, error: 'Choose an image file first.' };
  }

  if (file.size === 0) {
    return { ok: false, error: 'That file is empty. Choose a different image.' };
  }

  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: 'Use a JPEG, PNG or WebP image.' };
  }

  if (file.size > AVATAR_MAX_FILE_BYTES) {
    return { ok: false, error: `That image is larger than ${AVATAR_MAX_FILE_BYTES / (1024 * 1024)} MB. Choose a smaller one.` };
  }

  return { ok: true };
}

/**
 * Largest centred square inside an image, used to crop non-square photos without stretching them.
 *
 * @returns {{ sx: number, sy: number, size: number }}
 */
export function getSquareCrop(width, height) {
  const size = Math.min(width, height);

  return { sx: Math.floor((width - size) / 2), sy: Math.floor((height - size) / 2), size };
}
