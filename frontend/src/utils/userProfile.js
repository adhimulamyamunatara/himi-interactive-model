import { isValidAvatarDataUrl, normalizeAvatarColor } from './avatar.js';

const TEXT_FIELDS = ['college', 'branch', 'semester', 'learningGoal'];

const asText = (value) => (typeof value === 'string' ? value : '');

/**
 * Turn whatever was stored under `himi.user` into a safe user object, or null when it is not usable.
 * Older saved users (without avatar fields) keep working; unknown or invalid avatar data is dropped.
 *
 * @param {unknown} raw
 * @returns {object | null}
 */
export function normalizeStoredUser(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  if (typeof raw.name !== 'string' || typeof raw.email !== 'string' || !raw.name.trim()) {
    return null;
  }

  const user = { name: raw.name, email: raw.email };

  for (const field of TEXT_FIELDS) {
    user[field] = asText(raw[field]);
  }

  user.avatarColor = normalizeAvatarColor(raw.avatarColor);

  if (isValidAvatarDataUrl(raw.avatarImage)) {
    user.avatarImage = raw.avatarImage;
  }

  return user;
}
