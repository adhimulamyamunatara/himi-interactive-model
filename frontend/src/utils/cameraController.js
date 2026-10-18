/**
 * Camera stream controller. Framework-free so its safety rules can be unit tested with a fake `getUserMedia`.
 *
 * - The camera is only requested inside `start()`, which the UI calls from a button press. Nothing starts by itself.
 * - Every `start()` is numbered. If `stop()` (or a newer `start()`) happens while the browser is still asking for
 *   permission, the stream that arrives late is stopped immediately and never shown.
 * - `stop()` stops EVERY track, so the camera light goes off. It is safe to call at any time, any number of times.
 * - Only one stream can be open: a second `start()` while starting or live is ignored.
 */

import { describeMediaError } from './camera.js';

export const IDLE_CAMERA = Object.freeze({ status: 'idle', stream: null, errorKey: null, retryable: false });

const CONSTRAINTS = Object.freeze({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });

/** @param {{ getUserMedia?: (constraints: object) => Promise<MediaStream> }} [options] */
export function createCameraController({ getUserMedia = (constraints) => globalThis.navigator?.mediaDevices?.getUserMedia(constraints) } = {}) {
  const listeners = new Set();
  let snapshot = IDLE_CAMERA;
  let token = 0;
  let activeStream = null;

  const publish = (next) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
  };

  const releaseStream = (stream) => {
    try {
      stream?.getTracks().forEach((track) => track.stop());
    } catch {
      /* already stopped */
    }
  };

  const stop = () => {
    token += 1;
    releaseStream(activeStream);
    activeStream = null;

    if (snapshot.status !== 'idle' || snapshot.stream !== null) {
      publish({ status: 'idle', stream: null });
    }
  };

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    stop,

    /** @returns {Promise<boolean>} true when a stream is now live */
    async start() {
      if (snapshot.status === 'starting' || snapshot.status === 'live') {
        return false;
      }

      const mine = ++token;
      publish({ status: 'starting', stream: null, errorKey: null, retryable: false });

      let stream;

      try {
        stream = await getUserMedia(CONSTRAINTS);

        if (!stream) {
          throw Object.assign(new Error('No stream'), { name: 'NotFoundError' });
        }
      } catch (error) {
        if (mine === token) {
          const { key, retryable } = describeMediaError(error);
          publish({ status: 'error', stream: null, errorKey: key, retryable });
        }

        return false;
      }

      if (mine !== token) {
        // Stopped or restarted while the permission prompt was open: this stream must not stay on.
        releaseStream(stream);
        return false;
      }

      activeStream = stream;
      publish({ status: 'live', stream });
      return true;
    }
  };
}
