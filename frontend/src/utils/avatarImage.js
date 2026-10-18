import {
  AVATAR_DATA_URL_PREFIX,
  AVATAR_JPEG_QUALITY,
  AVATAR_MAX_DATA_URL_LENGTH,
  AVATAR_OUTPUT_SIZE,
  getSquareCrop,
  isValidAvatarDataUrl,
  sniffImageType,
  validateAvatarFile
} from './avatar.js';

/** Raised with a message that is safe to show to the student. */
export class AvatarImageError extends Error {}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      throw new AvatarImageError('That image could not be read. It may be damaged. Try another one.');
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AvatarImageError('That image could not be read. It may be damaged. Try another one.'));
    };
    image.src = url;
  });
}

/**
 * Validate a picked file, then crop and downscale it to a small JPEG data URL.
 * The original file is never stored or uploaded anywhere.
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function prepareAvatarImage(file) {
  const check = validateAvatarFile(file);

  if (!check.ok) {
    throw new AvatarImageError(check.error);
  }

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());

  if (!sniffImageType(header)) {
    throw new AvatarImageError('That file is not a real JPEG, PNG or WebP image.');
  }

  const source = await decodeImage(file);
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;

  if (!width || !height) {
    throw new AvatarImageError('That image has no size. Try another one.');
  }

  const { sx, sy, size } = getSquareCrop(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new AvatarImageError('Your browser could not process the image.');
  }

  // JPEG has no transparency, so paint white first so transparent PNGs do not turn black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
  context.drawImage(source, sx, sy, size, size, 0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
  source.close?.();

  const dataUrl = canvas.toDataURL('image/jpeg', AVATAR_JPEG_QUALITY);

  if (!dataUrl.startsWith(AVATAR_DATA_URL_PREFIX) || dataUrl.length > AVATAR_MAX_DATA_URL_LENGTH || !isValidAvatarDataUrl(dataUrl)) {
    throw new AvatarImageError('That image could not be made small enough. Try a simpler picture.');
  }

  return dataUrl;
}
