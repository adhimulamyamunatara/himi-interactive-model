import { useEffect, useRef } from 'react';
import { getSpeechOutput } from '../utils/speechOutput';
import { canAutoRead, createAutoReadTracker } from '../utils/voice';

/**
 * Reads a newly arrived reply aloud when the student turned on "Read replies aloud" and voice is enabled.
 *
 * - Replies already on screen when a conversation opens are never read (see `createAutoReadTracker`).
 * - Turning the setting on later does not read older replies.
 * - Nothing is read in a browser without speech synthesis, and Stop on the reply's Listen button still works.
 * - `replies` are `{ id, text }` for readable (non-error) assistant replies, oldest first.
 */
export function useAutoRead({ ownerKey, replies, voiceEnabled, autoReadReplies }) {
  const trackerRef = useRef(null);

  useEffect(() => {
    trackerRef.current ??= createAutoReadTracker();
    const fresh = trackerRef.current.next(
      ownerKey,
      replies.map((reply) => reply.id)
    );
    const output = getSpeechOutput();

    if (fresh === null || !canAutoRead({ voiceEnabled, autoReadReplies, supported: output.isSupported() })) {
      return;
    }

    const reply = replies.find((item) => item.id === fresh);

    if (reply) {
      output.speak(reply.id, reply.text);
    }
  }, [ownerKey, replies, voiceEnabled, autoReadReplies]);
}
