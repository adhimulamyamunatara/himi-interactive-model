/**
 * Browser-side photo preparation: turn a video frame or a chosen file into ONE reduced JPEG held in memory.
 * Nothing here stores or uploads anything. (Covered by the browser e2e tests rather than unit tests, because it
 * needs a real canvas.)
 */

import { base64ByteLength, fitWithin, MAX_SEND_BYTES, parseImageDataUrl } from './camera.js';

const QUALITIES = [0.82, 0.7, 0.55, 0.4];

function canvasFor(width, height) {
  const canvas = document.createElement('canvas');
  const size = fitWithin(width, height);
  canvas.width = size.width;
  canvas.height = size.height;
  return canvas;
}

function encode(canvas) {
  for (const quality of QUALITIES) {
    const parsed = parseImageDataUrl(canvas.toDataURL('image/jpeg', quality));

    if (parsed && base64ByteLength(parsed.base64) <= MAX_SEND_BYTES) {
      return { ...parsed, dataUrl: `data:${parsed.mimeType};base64,${parsed.base64}`, width: canvas.width, height: canvas.height, canvas };
    }
  }

  return null;
}

function paint(canvas, source) {
  const context = canvas.getContext('2d');

  if (!context) {
    return false;
  }

  // PNG/WebP with transparency would turn black in JPEG, so paint white first.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return true;
}

/** One still frame of the live preview. Returns null if the video has no picture yet. */
export function photoFromVideo(video) {
  if (!video?.videoWidth || !video?.videoHeight) {
    return null;
  }

  const canvas = canvasFor(video.videoWidth, video.videoHeight);
  return paint(canvas, video) ? encode(canvas) : null;
}

/** A file the student picked. Returns null when the browser cannot decode it as an image. */
export async function photoFromFile(file) {
  let bitmap = null;

  try {
    bitmap = await createImageBitmap(file);
    const canvas = canvasFor(bitmap.width, bitmap.height);
    return paint(canvas, bitmap) ? encode(canvas) : null;
  } catch {
    return null;
  } finally {
    bitmap?.close?.();
  }
}
