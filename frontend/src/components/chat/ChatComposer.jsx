import { useCallback, useState } from 'react';
import { FiMic, FiSend } from 'react-icons/fi';
import { useAutoResizeTextarea } from '../../hooks/useAutoResizeTextarea';
import { useSpeechInput } from '../../hooks/useSpeechInput';
import { useT } from '../../i18n/I18nContext';
import { appendTranscript } from '../../utils/speechText';
import VoicePanel from '../voice/VoicePanel';

const MAX_LENGTH = 2000;

/**
 * Message box with an auto-growing textarea. Enter sends, Shift+Enter inserts a new line.
 * Dictation (opt-in, from the mic button) only adds text to the box; sending is always the student's action.
 * `voiceKey` is the id of the open conversation: changing it cancels any dictation in progress.
 */
export default function ChatComposer({ onSend, disabled = false, subject, voiceKey = null, voiceEnabled = true, dictationLanguage = null }) {
  const { t } = useT();
  const [draft, setDraft] = useState('');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const textareaRef = useAutoResizeTextarea(draft);
  const canSend = !disabled && draft.trim().length > 0;

  const addTranscript = useCallback((text) => setDraft((current) => appendTranscript(current, text, MAX_LENGTH).value), []);
  const voice = useSpeechInput({ resetKey: voiceKey, onTranscript: addTranscript });

  const toggleVoice = () => {
    if (voiceOpen) {
      voice.cancel();
    } else if (dictationLanguage) {
      voice.setLanguage(dictationLanguage);
    }

    setVoiceOpen(!voiceOpen);
  };

  // With voice turned off in settings the panel and mic button are not rendered at all.
  const showVoice = voiceEnabled && voiceOpen;

  const closeVoice = () => {
    voice.cancel();
    setVoiceOpen(false);
  };

  const submit = () => {
    if (!canSend) {
      return;
    }

    const content = draft;
    voice.cancel();
    setDraft('');
    onSend(content);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-slate-200 bg-white p-3 shadow-card transition focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100"
    >
      {showVoice ? <VoicePanel voice={voice} onClose={closeVoice} /> : null}
      <label htmlFor="chat-message" className="sr-only">
        Message HIMI about {subject}
      </label>
      <textarea
        ref={textareaRef}
        id="chat-message"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        maxLength={MAX_LENGTH}
        placeholder={`Ask HIMI anything about ${subject}…`}
        className="scrollbar-thin block max-h-40 w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="hidden pl-3 text-xs text-slate-500 sm:block">
          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-sans font-medium">Enter</kbd> to send ·{' '}
          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-sans font-medium">Shift</kbd> +{' '}
          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-sans font-medium">Enter</kbd> for new line
        </p>
        <div className="ml-auto flex items-center gap-2">
          {draft.length > MAX_LENGTH * 0.8 ? (
            <span className="text-xs text-slate-500" aria-live="polite">
              {draft.length}/{MAX_LENGTH}
            </span>
          ) : null}
          {voiceEnabled ? (
            <button
              type="button"
              onClick={toggleVoice}
              aria-pressed={voiceOpen}
              aria-label={t('voice.input')}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${
                voice.status === 'listening'
                  ? 'animate-pulse border-rose-300 bg-rose-50 text-rose-600'
                  : voiceOpen
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-slate-50 hover:text-blue-600'
              }`}
            >
              <FiMic aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-semibold text-white shadow-sm transition enabled:hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send <FiSend aria-hidden="true" />
          </button>
        </div>
      </div>
    </form>
  );
}
