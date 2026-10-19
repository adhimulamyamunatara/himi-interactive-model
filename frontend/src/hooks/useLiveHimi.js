import { useCallback, useEffect, useRef, useState } from 'react';
import { companionSpeechId, useCompanion, useRobotState } from '../context/CompanionContext';
import { useUser } from '../context/UserContext';
import { liveLine } from '../utils/basicHimi';
import { INITIAL_LIVE, liveStep, speakableReply } from '../utils/liveLoop';
import { createSpeechInput, describeSpeechError, getSpeechInputSupport } from '../utils/speechInput';
import { getSpeechOutput } from '../utils/speechOutput';
import { MAX_MESSAGE_CHARS } from '../utils/tutor';
import { voiceInputLanguageFor } from '../utils/voice';
import { usePreferences } from './usePreferences';
import { useSpeechOutput } from './useSpeechOutput';

/** A short gap before listening again, so the browser has released the microphone from the last turn. */
const LISTEN_DELAY_MS = 250;
const GREETING_ID = 'companion-live-greeting';
/** Speech recognition problems that will not fix themselves, so HIMI stops listening and offers typing. */
const FATAL_MIC_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported', 'network']);

/**
 * Runs HIMI's full-screen live conversation. It owns the microphone and the reading aloud while the live view
 * is open, and only then: it is mounted by the live view, so nothing listens before the student asked for it.
 *
 * The turn-taking decisions are made by `liveStep` (pure, tested). This hook carries them out with the browser's
 * speech recognition and synthesis and the shared companion conversation (the same tutor, transcript, subject
 * and language as the dock and the dashboard).
 *
 * It is a turn-based loop, not streaming audio: HIMI never listens while it speaks.
 */
export function useLiveHimi() {
  const companion = useCompanion();
  const { user } = useUser();
  const { preferences } = usePreferences();
  const output = useSpeechOutput();
  const [support] = useState(() => getSpeechInputSupport());
  const [machine, setMachine] = useState(INITIAL_LIVE);
  const [micActive, setMicActive] = useState(false);
  const [interim, setInterim] = useState('');
  const [micError, setMicError] = useState('');
  const [speakReplies, setSpeakReplies] = useState(true);

  const voiceAllowed = preferences.voiceEnabled;
  const canListen = voiceAllowed && support.supported;
  const canSpeakDevice = voiceAllowed && output.supported;

  const machineRef = useRef(INITIAL_LIVE);
  const controllerRef = useRef(null);
  const listenTimerRef = useRef(null);
  const requestTokenRef = useRef(0);
  const speakIdRef = useRef(null);
  const runActionsRef = useRef(() => {});
  const latestRef = useRef({});

  useEffect(() => {
    latestRef.current = { companion, name: user?.name ?? '', language: companion.explanationLanguage };
  });

  const dispatch = useCallback((event) => {
    const step = liveStep(machineRef.current, event);
    machineRef.current = step.state;
    setMachine(step.state);
    runActionsRef.current(step.actions);
  }, []);

  const stopListening = () => {
    clearTimeout(listenTimerRef.current);
    listenTimerRef.current = null;
    controllerRef.current?.abort();
    setMicActive(false);
    setInterim('');
  };

  const startListening = () => {
    // The loop may have moved on (paused, interrupted, left) while the short delay ran.
    if (machineRef.current.phase !== 'listening') {
      return;
    }

    controllerRef.current ??= createSpeechInput();
    const heard = [];
    let errorCode = '';

    const result = controllerRef.current.start({
      language: voiceInputLanguageFor(latestRef.current.language),
      onStart: () => setMicActive(true),
      onInterim: (text) => setInterim(text),
      onFinal: (text) => heard.push(text),
      onError: (code) => {
        errorCode = code;
      },
      onEnd: () => {
        setMicActive(false);
        setInterim('');

        if (FATAL_MIC_ERRORS.has(errorCode)) {
          setMicError(describeSpeechError(errorCode)?.message ?? '');
          dispatch({ type: 'mic-lost' });
          return;
        }

        dispatch({ type: 'listen-ended', text: heard.join(' ') });
      }
    });

    if (!result.ok && result.reason !== 'busy') {
      setMicError('Voice input is not available here. You can type to HIMI instead.');
      dispatch({ type: 'mic-lost' });
    }
  };

  const speakText = (id, text) => {
    // Nothing speakable (or the engine refused): do not wait for an "ended" event that will never come.
    if (!getSpeechOutput().speak(id, text)) {
      dispatch({ type: 'speech-ended' });
    }
  };

  /** Ask the tutor and turn its outcome into the next event. A reply that lost its turn is never spoken. */
  const ask = async (text) => {
    const mine = ++requestTokenRef.current;
    const { companion: current, language } = latestRef.current;
    const result = await current.send(text, { live: true });

    if (mine !== requestTokenRef.current || machineRef.current.phase !== 'thinking') {
      return;
    }

    if (result.reason === 'local') {
      // "Open the whiteboard": the page opens, so the full-screen view gets out of the way.
      dispatch({ type: 'stop' });
      current.closeLive();
      return;
    }

    if (!result.started) {
      if (result.reason === 'too-long') {
        dispatch({ type: 'replied', speak: liveLine('tooLong', language) });
      } else {
        dispatch({ type: 'reply-failed' });
      }

      return;
    }

    const entry = result.entry;

    if (entry?.kind === 'answer') {
      speakIdRef.current = companionSpeechId(entry.id);
      dispatch({ type: 'replied', speak: speakableReply(entry.text) });
    } else if (entry?.kind === 'handoff') {
      speakIdRef.current = companionSpeechId(entry.id);
      dispatch({ type: 'replied', speak: liveLine(`handoff.${entry.handoff?.kind}`, language) });
    } else if (entry?.kind === 'clarify') {
      speakIdRef.current = companionSpeechId(entry.id);
      dispatch({ type: 'replied', speak: liveLine('clarify', language) });
    } else {
      speakIdRef.current = null;
      dispatch({ type: 'replied', speak: liveLine('error', language) });
    }
  };

  const runActions = (actions) => {
    for (const action of actions) {
      switch (action.type) {
        case 'listen':
          clearTimeout(listenTimerRef.current);
          listenTimerRef.current = setTimeout(startListening, LISTEN_DELAY_MS);
          break;
        case 'stop-listen':
          stopListening();
          break;
        case 'stop-speak':
          getSpeechOutput().stop();
          break;
        case 'speak-greeting':
          speakText(GREETING_ID, liveLine('greeting', latestRef.current.language, { name: latestRef.current.name }));
          break;
        case 'speak':
          speakText(speakIdRef.current ?? 'companion-live-reply', action.text);
          break;
        case 'send':
          ask(action.text);
          break;
        case 'cancel-request':
          requestTokenRef.current += 1;
          latestRef.current.companion.cancel();
          break;
        default:
          break;
      }
    }
  };

  useEffect(() => {
    runActionsRef.current = runActions;
  });

  // Speech finished (or failed): move the loop on. Subscribed to the shared reader, not polled. Declared before the
  // start effect so the greeting's end is never missed.
  useEffect(() => {
    const reader = getSpeechOutput();
    const isLiveSpeech = () => {
      const { speakingId } = reader.getSnapshot();
      return typeof speakingId === 'string' && speakingId.startsWith('companion-');
    };
    let wasSpeaking = isLiveSpeech();

    return reader.subscribe(() => {
      const speakingNow = isLiveSpeech();

      if (wasSpeaking && !speakingNow) {
        dispatch({ type: 'speech-ended' });
      }

      wasSpeaking = speakingNow;
    });
  }, [dispatch]);

  // The loop starts when the live view opens and stops completely when it closes. Nothing runs before that.
  const startOptions = { canListen, canSpeak: canSpeakDevice && speakReplies, reason: voiceAllowed ? 'unsupported' : 'voice-off' };
  const startRef = useRef(startOptions);
  useEffect(() => {
    startRef.current = startOptions;
  });

  useEffect(() => {
    dispatch({ type: 'start', ...startRef.current });

    return () => {
      requestTokenRef.current += 1;
      dispatch({ type: 'stop' });
    };
  }, [dispatch]);

  // Leaving the tab stops the microphone and the voice; the student taps to carry on.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) {
        dispatch({ type: 'pause', reason: 'hidden' });
      }
    };
    const onPageHide = () => dispatch({ type: 'stop' });

    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [dispatch]);

  const submitText = useCallback((text) => dispatch({ type: 'submit', text }), [dispatch]);

  /** Tap on HIMI: interrupt what it is saying or thinking, or start listening again after a pause. */
  const interrupt = useCallback(() => {
    setMicError('');
    dispatch({ type: 'interrupt' });
  }, [dispatch]);

  /** The microphone button: mute while HIMI is listening or talking, resume otherwise. */
  const toggleMic = useCallback(() => {
    const { phase } = machineRef.current;

    if (phase === 'paused' || phase === 'text') {
      setMicError('');
      dispatch({ type: 'resume' });
    } else {
      dispatch({ type: 'pause', reason: 'muted' });
    }
  }, [dispatch]);

  const toggleSpeakReplies = useCallback(() => {
    const next = !speakReplies;
    setSpeakReplies(next);
    dispatch({ type: 'set-can-speak', value: canSpeakDevice && next });
  }, [canSpeakDevice, dispatch, speakReplies]);

  const { setExplanationLanguage } = companion;
  const changeLanguage = useCallback(
    (code) => {
      setExplanationLanguage(code);

      // Already listening in the old language: start over in the new one.
      if (machineRef.current.phase === 'listening') {
        dispatch({ type: 'pause', reason: 'muted' });
        dispatch({ type: 'resume' });
      }
    },
    [dispatch, setExplanationLanguage]
  );

  const robotState = useRobotState({ listening: micActive });
  const speaking = robotState === 'speaking';

  return {
    phase: machine.phase,
    maxLength: MAX_MESSAGE_CHARS,
    reason: machine.reason,
    micActive,
    interim,
    micError,
    speechFailed: typeof output.errorId === 'string' && output.errorId.startsWith('companion-') && Boolean(output.error),
    canListen,
    canSpeakDevice,
    speakReplies,
    voiceAllowed,
    robotState,
    speaking,
    thinking: companion.status === 'thinking',
    submitText,
    interrupt,
    toggleMic,
    toggleSpeakReplies,
    changeLanguage
  };
}
