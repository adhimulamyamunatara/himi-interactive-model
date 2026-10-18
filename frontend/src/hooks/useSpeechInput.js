import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_VOICE_LANGUAGE, SUPPORT_MESSAGES, createSpeechInput, describeSpeechError, getSpeechInputSupport, isVoiceLanguage } from '../utils/speechInput';

const IDLE = Object.freeze({ status: 'idle', interim: '', error: '', notice: '' });
const STOP_TIMEOUT_MS = 3000;

/**
 * Voice input for the chat composer.
 *
 * `resetKey` identifies the conversation that owns the dictation. When it changes (another chat is opened or
 * deleted) the active session is aborted and the visible state resets, so words that arrive late can never
 * land in the wrong conversation. Dictated text is only handed to `onTranscript`; nothing here ever sends.
 * The microphone is only requested from `start()`, which must be called from a user action.
 */
export function useSpeechInput({ resetKey, onTranscript }) {
  const [support] = useState(() => getSpeechInputSupport());
  const [state, setState] = useState(IDLE);
  const [language, setLanguageState] = useState(DEFAULT_VOICE_LANGUAGE);
  const [seenKey, setSeenKey] = useState(resetKey);
  const controllerRef = useRef(null);
  const stopTimerRef = useRef(null);
  const latestRef = useRef({ resetKey, onTranscript });

  // Another conversation took over: forget what the old one was doing (React-approved "reset on key change").
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setState(IDLE);
  }

  useEffect(() => {
    latestRef.current = { resetKey, onTranscript };
  });

  const getController = useCallback(() => {
    controllerRef.current ??= createSpeechInput();
    return controllerRef.current;
  }, []);

  const clearStopTimer = useCallback(() => {
    clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
  }, []);

  // Abort when the conversation changes and when the composer goes away (leaving the page, logout, ...).
  useEffect(
    () => () => {
      clearTimeout(stopTimerRef.current);
      controllerRef.current?.abort();
    },
    [resetKey]
  );

  useEffect(() => {
    const interrupt = () => {
      if (document.hidden && controllerRef.current?.isActive()) {
        controllerRef.current.abort();
        setState({ ...IDLE, notice: 'Voice input stopped because you left this tab.' });
      }
    };
    const abort = () => controllerRef.current?.abort();

    document.addEventListener('visibilitychange', interrupt);
    window.addEventListener('pagehide', abort);

    return () => {
      document.removeEventListener('visibilitychange', interrupt);
      window.removeEventListener('pagehide', abort);
    };
  }, []);

  const start = useCallback(() => {
    const ownerKey = latestRef.current.resetKey;
    const owns = () => latestRef.current.resetKey === ownerKey;

    setState({ status: 'starting', interim: '', error: '', notice: '' });

    const result = getController().start({
      language,
      onStart: () => {
        if (owns()) setState((current) => (current.status === 'starting' ? { ...current, status: 'listening' } : current));
      },
      onInterim: (text) => {
        if (owns()) setState((current) => (current.interim === text ? current : { ...current, interim: text }));
      },
      onFinal: (text) => {
        if (owns()) latestRef.current.onTranscript(text);
      },
      onError: (code) => {
        const info = describeSpeechError(code);

        if (owns() && info) setState((current) => ({ ...current, error: info.message }));
      },
      onEnd: ({ heardSpeech, errored }) => {
        clearStopTimer();

        if (!owns()) return;

        setState((current) => ({
          status: 'idle',
          interim: '',
          error: current.error,
          notice: heardSpeech
            ? 'Added to your message. Check it, edit anything that is wrong, then press Send.'
            : errored || current.error
              ? ''
              : 'Nothing was captured, so nothing was added.'
        }));
      }
    });

    if (!result.ok && result.reason !== 'busy') {
      setState({
        ...IDLE,
        error: SUPPORT_MESSAGES[result.reason] ?? 'Voice input could not start. Try again, or type your question.'
      });
    }
  }, [clearStopTimer, getController, language]);

  const stop = useCallback(() => {
    if (!controllerRef.current?.isActive()) return;

    setState((current) => ({ ...current, status: 'stopping' }));
    controllerRef.current.stop();
    clearStopTimer();
    // If the browser never reports the end, do not leave the button stuck.
    stopTimerRef.current = setTimeout(() => {
      controllerRef.current?.abort();
      setState(IDLE);
    }, STOP_TIMEOUT_MS);
  }, [clearStopTimer]);

  /** Drop the session and its messages silently (panel closed, message sent). */
  const cancel = useCallback(() => {
    clearStopTimer();
    controllerRef.current?.abort();
    setState(IDLE);
  }, [clearStopTimer]);

  const setLanguage = useCallback((code) => {
    if (isVoiceLanguage(code) && !controllerRef.current?.isActive()) setLanguageState(code);
  }, []);

  return {
    supported: support.supported,
    supportReason: support.reason,
    status: state.status,
    interim: state.interim,
    error: state.error,
    notice: state.notice,
    language,
    setLanguage,
    start,
    stop,
    cancel
  };
}
