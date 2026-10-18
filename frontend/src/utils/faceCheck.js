/**
 * Optional "is there a face in this photo?" privacy check, using the browser's built-in Shape Detection API
 * (`FaceDetector`) when it exists. It runs on the captured still only, on the student's device, and returns a
 * COUNT: no identity, no landmarks, no emotion, nothing stored and nothing sent anywhere.
 *
 * Most browsers do not ship `FaceDetector`; there the check is simply unavailable and the UI says so.
 */

/** @returns {Promise<{ status: 'unavailable' | 'failed' | 'done', faces: number }>} */
export async function countFaces(source, { Detector = globalThis.FaceDetector } = {}) {
  if (typeof Detector !== 'function') {
    return { status: 'unavailable', faces: 0 };
  }

  try {
    const detector = new Detector({ fastMode: true, maxDetectedFaces: 5 });
    const found = await detector.detect(source);
    return { status: 'done', faces: Array.isArray(found) ? found.length : 0 };
  } catch {
    return { status: 'failed', faces: 0 };
  }
}
