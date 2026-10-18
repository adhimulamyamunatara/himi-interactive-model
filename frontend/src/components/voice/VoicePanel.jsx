import { FiAlertCircle, FiInfo, FiMic, FiSquare, FiX } from 'react-icons/fi';
import { SUPPORT_MESSAGES, VOICE_LANGUAGES } from '../../utils/speechInput';

const START_LABELS = {
  idle: 'Start listening',
  starting: 'Waiting for microphone…',
  listening: 'Stop listening',
  stopping: 'Finishing…'
};

const STATUS_TEXT = {
  starting: 'Your browser may ask for permission to use the microphone.',
  listening: 'Listening… speak now.',
  stopping: 'Finishing up…'
};

/**
 * Voice input controls shown above the composer. Dictation fills the normal message box, so the student
 * always reviews and edits the text and presses Send themselves. The panel is explicit about where audio goes.
 */
export default function VoicePanel({ voice, onClose }) {
  const busy = voice.status !== 'idle';
  const listening = voice.status === 'listening';
  const unavailable = !voice.supported;

  return (
    <div role="group" aria-label="Voice input" className="mb-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">Speak your question</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close voice input"
          className="rounded-lg p-1 text-slate-500 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
        >
          <FiX aria-hidden="true" />
        </button>
      </div>

      {unavailable ? (
        <p className="mt-2 flex items-start gap-2 text-sm text-slate-700">
          <FiInfo className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" /> {SUPPORT_MESSAGES[voice.supportReason] ?? SUPPORT_MESSAGES.unsupported}
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="voice-language" className="text-xs font-medium text-slate-600">
                Voice language
              </label>
              <select
                id="voice-language"
                value={voice.language}
                onChange={(event) => voice.setLanguage(event.target.value)}
                disabled={busy}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-60"
              >
                {VOICE_LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={listening ? voice.stop : voice.start}
              disabled={voice.status === 'starting' || voice.status === 'stopping'}
              aria-busy={voice.status === 'starting'}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${
                listening ? 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-200' : 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-200'
              }`}
            >
              {listening ? <FiSquare aria-hidden="true" /> : <FiMic aria-hidden="true" />} {START_LABELS[voice.status]}
            </button>
          </div>

          <div role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-slate-700">
            {STATUS_TEXT[voice.status] ?? voice.notice}
          </div>

          {voice.interim ? (
            <p className="mt-1 rounded-xl bg-white px-3 py-2 text-sm italic text-slate-600" data-testid="voice-interim">
              Hearing: {voice.interim}
            </p>
          ) : null}

          {voice.error ? (
            <p role="alert" className="mt-2 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <FiAlertCircle className="mt-0.5 shrink-0" aria-hidden="true" /> {voice.error}
            </p>
          ) : null}
        </>
      )}

      <p className="mt-3 text-xs leading-5 text-slate-600">
        Voice input uses your browser&apos;s speech recognition. In Chrome and Edge your audio is sent to the browser maker&apos;s online speech service to be turned into text.
        HIMI never receives or stores your audio. Only the text you review and send is shared with HIMI. Nothing is sent until you press Send.
      </p>
    </div>
  );
}
