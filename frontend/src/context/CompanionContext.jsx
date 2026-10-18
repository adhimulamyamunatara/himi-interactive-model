import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from './ChatContext';
import { useUser } from './UserContext';
import { usePreferences } from '../hooks/usePreferences';
import { useSpeechOutput } from '../hooks/useSpeechOutput';
import { askTutor, describeTutorError } from '../services/tutorService';
import { basicReply } from '../utils/basicHimi';
import { loadQuizAttempts } from '../utils/analyticsStorage';
import { deriveRobotState } from '../utils/companionState';
import { createCompanionSession } from '../utils/companionSession';
import { getSpeechOutput } from '../utils/speechOutput';
import { MAX_MESSAGE_CHARS, buildProgressSummary, buildTutorRequest } from '../utils/tutor';
import { appendTranscript } from '../utils/speechText';

const CompanionContext = createContext(null);

/** Speech ids of the companion's replies start with this, so its playback is never confused with Chat's. */
export const COMPANION_SPEECH_PREFIX = 'companion-';
export const companionSpeechId = (entryId) => `${COMPANION_SPEECH_PREFIX}${entryId}`;

/** A live conversation gives up on a slow AI after this long and answers in basic mode, so it never goes silent. */
export const LIVE_REPLY_TIMEOUT_MS = 25_000;

const isWideScreen = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 768px)').matches;

/**
 * The one HIMI companion for the whole app.
 *
 * It sits above the router, so the conversation survives moving between pages, and there is exactly one
 * conversation no matter how many places show it (the floating dock, the dashboard stage): they are views
 * of the same state, never separate robots with separate histories.
 *
 * Questions go through the existing multi-agent tutor with the student's active subject, explanation
 * language and help mode. The transcript is kept in memory only (it is gone on refresh, sign-out or
 * "Start over") and only whether the panel was left open is remembered in the preferences.
 */
export function CompanionProvider({ children }) {
  const { user } = useUser();
  const navigate = useNavigate();
  const { selectedSubject, setSelectedSubject } = useChat();
  const { preferences, update } = usePreferences();
  const [session] = useState(() => createCompanionSession({ ask: askTutor, describeError: describeTutorError }));
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);

  // The saved "left open" choice only applies on wide screens; on a phone the panel is a full sheet and starts closed.
  const [open, setOpenState] = useState(() => preferences.companionOpen && isWideScreen());
  const [draft, setDraft] = useState('');
  // The full-screen live conversation. Never remembered: it always starts closed, so the microphone cannot start by itself.
  const [live, setLive] = useState(false);
  const [focusNonce, setFocusNonce] = useState(0);

  const userKey = user?.email ?? null;
  const latestRef = useRef({});

  useEffect(() => {
    latestRef.current = { user, subject: selectedSubject, preferences };
  });

  useEffect(() => () => session.dispose(), [session]);

  // A different student (or sign-out) starts from a blank conversation, and nothing keeps talking.
  // The unsent draft belongs to the conversation that just ended, so it is dropped during render (React's "reset on key change").
  const [seenUserKey, setSeenUserKey] = useState(userKey);

  if (seenUserKey !== userKey) {
    setSeenUserKey(userKey);
    setDraft('');
  }

  const previousUserRef = useRef(userKey);
  useEffect(() => {
    if (previousUserRef.current !== userKey) {
      previousUserRef.current = userKey;
      getSpeechOutput().stop();
      session.reset();
      setLive(false);
    }
  }, [userKey, session]);

  const setOpen = useCallback(
    (next) => {
      setOpenState(next);

      if (isWideScreen()) {
        update({ companionOpen: next });
      }
    },
    [update]
  );

  /** Builds the tutor request for `message` under `subject`, with the language and help mode in force right now. */
  const makeBuilder = useCallback((message, subject) => (history) => {
    const { user: currentUser, preferences: prefs } = latestRef.current;

    return buildTutorRequest({
      message,
      subject,
      topic: '',
      userName: currentUser?.name ?? '',
      language: prefs.explanationLanguage,
      helpMode: prefs.helpMode,
      history,
      progress: buildProgressSummary(loadQuizAttempts().attempts, subject)
    });
  }, []);

  /** In a live conversation a failed or slow AI answers in basic mode instead of ending the conversation. */
  const liveOptions = useCallback(
    () => ({
      timeoutMs: LIVE_REPLY_TIMEOUT_MS,
      fallback: (message) => {
        const { user: currentUser, preferences: prefs } = latestRef.current;
        return basicReply(message, { language: prefs.explanationLanguage, name: currentUser?.name ?? '' });
      }
    }),
    []
  );

  const send = useCallback(
    async (text, { live: inLive = false } = {}) => {
      const message = typeof text === 'string' ? text : '';
      const { subject } = latestRef.current;
      // Speech from the previous answer must not talk over the question being asked.
      getSpeechOutput().stop();

      const result = await session.send(message, makeBuilder(message, subject), { subject, ...(inLive ? liveOptions() : {}) });

      if (result.started && result.reason === 'local' && result.to) {
        navigate(result.to);
      }

      return result;
    },
    [liveOptions, makeBuilder, navigate, session]
  );

  const retry = useCallback(async (options = {}) => {
    const last = session.getSnapshot().lastQuestion;

    if (!last) {
      return { started: false, reason: 'nothing-to-retry' };
    }

    getSpeechOutput().stop();
    return session.retry(makeBuilder(last.text, last.subject), options?.live ? liveOptions() : {});
  }, [liveOptions, makeBuilder, session]);

  const reset = useCallback(() => {
    getSpeechOutput().stop();
    session.reset();
    setDraft('');
  }, [session]);

  const openLive = useCallback(() => {
    // The panel and the dashboard card hand over to the full-screen view; the conversation itself is shared.
    setOpenState(false);
    setLive(true);
  }, []);
  const closeLive = useCallback(() => setLive(false), []);

  const setExplanationLanguage = useCallback((code) => update({ explanationLanguage: code }), [update]);

  /** Put text in the message box (never sends it) and bring the companion up, so the student reviews it first. */
  const askHimi = useCallback(
    (text) => {
      setDraft(String(text ?? '').slice(0, MAX_MESSAGE_CHARS));
      setOpenState(true);
      setFocusNonce((value) => value + 1);
    },
    []
  );

  const appendToDraft = useCallback((text) => setDraft((current) => appendTranscript(current, text, MAX_MESSAGE_CHARS).value), []);
  const requestFocus = useCallback(() => setFocusNonce((value) => value + 1), []);

  const value = useMemo(
    () => ({
      entries: snapshot.entries,
      status: snapshot.status,
      error: snapshot.error,
      epoch: snapshot.epoch,
      celebrating: snapshot.celebrating,
      teaching: snapshot.teaching,
      basic: snapshot.basic,
      live,
      openLive,
      closeLive,
      lastQuestion: snapshot.lastQuestion,
      subject: selectedSubject,
      setSubject: setSelectedSubject,
      explanationLanguage: preferences.explanationLanguage,
      setExplanationLanguage,
      open,
      setOpen,
      draft,
      setDraft,
      appendToDraft,
      focusNonce,
      requestFocus,
      askHimi,
      send,
      retry,
      cancel: session.cancel,
      reset,
      celebrate: session.celebrate
    }),
    [appendToDraft, askHimi, closeLive, draft, focusNonce, live, open, openLive, preferences.explanationLanguage, requestFocus, reset, retry, selectedSubject, send, session, setExplanationLanguage, setOpen, setSelectedSubject, snapshot]
  );

  return <CompanionContext.Provider value={value}>{children}</CompanionContext.Provider>;
}

export function useCompanion() {
  const context = useContext(CompanionContext);

  if (!context) {
    throw new Error('useCompanion must be used within CompanionProvider');
  }

  return context;
}

/**
 * The robot's current state, from what is really happening. `listening` is passed by the view that owns the
 * microphone (only the open panel can listen); everything else is read from shared state.
 */
export function useRobotState({ listening = false } = {}) {
  const { status, error, celebrating, teaching } = useCompanion();
  const { speakingId } = useSpeechOutput();

  return deriveRobotState({
    listening,
    speaking: typeof speakingId === 'string' && speakingId.startsWith(COMPANION_SPEECH_PREFIX),
    thinking: status === 'thinking',
    celebrating,
    error: status === 'error' && Boolean(error),
    teaching
  });
}
