import { useEffect } from 'react';
import { FiPlay, FiRepeat, FiSquare } from 'react-icons/fi';
import { useSpeechOutput } from '../../hooks/useSpeechOutput';
import { getSpeechOutput } from '../../utils/speechOutput';

/**
 * Reads one assistant reply aloud on request, with Stop and Replay. Hidden in browsers without speech
 * synthesis, where the reply simply stays text. Audio is produced by the browser; nothing is sent to HIMI.
 */
export default function ListenButton({ messageId, text }) {
  const { supported, speakingId, lastId, errorId, error, speak, stop } = useSpeechOutput();
  const speaking = speakingId === messageId;
  const played = lastId === messageId;

  // A reply that disappears (chat cleared, deleted or switched) must not keep talking.
  useEffect(
    () => () => {
      const output = getSpeechOutput();

      if (output.getSnapshot().speakingId === messageId) {
        output.stop();
      }
    },
    [messageId]
  );

  if (!supported) {
    return null;
  }

  const Icon = speaking ? FiSquare : played ? FiRepeat : FiPlay;
  const label = speaking ? 'Stop' : played ? 'Replay' : 'Listen';
  const description = speaking ? 'Stop reading this reply' : played ? 'Replay this reply aloud' : 'Read this reply aloud';

  return (
    <>
      <button
        type="button"
        onClick={() => (speaking ? stop() : speak(messageId, text))}
        aria-label={description}
        aria-pressed={speaking}
        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition hover:bg-slate-100 hover:text-slate-900 focus-visible:opacity-100 ${
          speaking ? 'bg-blue-50 text-blue-700 opacity-100' : 'text-slate-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
        }`}
      >
        <Icon aria-hidden="true" /> {label}
      </button>
      {errorId === messageId && error ? (
        <span role="status" className="text-xs text-rose-600">
          {error}
        </span>
      ) : null}
    </>
  );
}
