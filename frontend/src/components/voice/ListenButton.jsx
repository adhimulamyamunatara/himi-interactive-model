import { useEffect } from 'react';
import { FiPlay, FiRepeat, FiSquare } from 'react-icons/fi';
import { useT } from '../../i18n/I18nContext';
import { useSpeechOutput } from '../../hooks/useSpeechOutput';
import { useVoiceAvailability } from '../../hooks/useVoiceAvailability';
import { detectSpeechLang } from '../../utils/speechText';
import { getSpeechOutput } from '../../utils/speechOutput';

/**
 * Reads one assistant reply aloud on request, with Stop and Replay. Hidden in browsers without speech
 * synthesis, where the reply simply stays text. Audio is produced by the browser; nothing is sent to HIMI.
 * `alwaysVisible` keeps it on screen without hovering (used by the companion).
 */
export default function ListenButton({ messageId, text, alwaysVisible = false }) {
  const { t } = useT();
  const { supported, speakingId, lastId, errorId, error, speak, stop } = useSpeechOutput();
  const lang = detectSpeechLang(text);
  const teluguVoice = useVoiceAvailability('te-IN');
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
  const label = speaking ? t('voice.stop') : played ? t('voice.replay') : t('voice.listen');
  const description = speaking ? t('voice.stopLabel') : played ? t('voice.replayLabel') : t('voice.listenLabel');
  const voiceMissing = lang === 'te-IN' && teluguVoice === 'missing' && (speaking || played);

  return (
    <>
      <button
        type="button"
        onClick={() => (speaking ? stop() : speak(messageId, text))}
        aria-label={description}
        aria-pressed={speaking}
        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition hover:bg-slate-100 hover:text-slate-900 focus-visible:opacity-100 ${
          speaking ? 'bg-blue-50 text-blue-700 opacity-100' : alwaysVisible ? 'text-slate-600 opacity-100' : 'text-slate-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
        }`}
      >
        <Icon aria-hidden="true" /> {label}
      </button>
      {voiceMissing ? (
        <span role="status" className="text-xs text-amber-700">
          {t('voice.noTeluguVoice')}
        </span>
      ) : null}
      {errorId === messageId && error ? (
        <span role="status" className="text-xs text-rose-600">
          {error}
        </span>
      ) : null}
    </>
  );
}
