import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiAlertCircle, FiArrowRight, FiEdit3, FiMic, FiMicOff, FiSend, FiSquare, FiVolume2, FiVolumeX, FiX } from 'react-icons/fi';
import HimiRobot from './HimiRobot';
import MarkdownMessage from '../chat/MarkdownMessage';
import { useCompanion } from '../../context/CompanionContext';
import { useUser } from '../../context/UserContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useLiveHimi } from '../../hooks/useLiveHimi';
import { useT } from '../../i18n/I18nContext';
import { robotStateLabelKey } from '../../utils/companionState';
import { LANGUAGES } from '../../utils/preferences';
import { actionLabelKey, actionRoute } from '../../utils/tutor';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ROUND_BASE =
  'inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border text-xl text-white transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/70 disabled:cursor-not-allowed disabled:opacity-50';
const ROUND_BUTTON = `${ROUND_BASE} border-white/25 bg-white/10 hover:bg-white/20`;
const ROUND_ACTIVE = `${ROUND_BASE} border-rose-300/60 bg-rose-500 hover:bg-rose-400`;
const TOOL_LINK =
  'inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200';

/** Which line of help to show under the robot, from what the loop is doing and why it stopped. */
function hintKey(phase, reason) {
  if (phase === 'off') {
    return null;
  }

  if (phase === 'paused') {
    return `companion.live.hint.paused.${['silence', 'hidden'].includes(reason) ? reason : 'muted'}`;
  }

  if (phase === 'text') {
    return `companion.live.hint.text.${['mic', 'voice-off'].includes(reason) ? reason : 'unsupported'}`;
  }

  return `companion.live.hint.${['greeting', 'listening', 'thinking', 'speaking'].includes(phase) ? phase : 'listening'}`;
}

/** What HIMI last said, with the real tool links the tutor offered. Links never open by themselves. */
function HimiCaption({ entry, thinking, onLeave }) {
  const { t } = useT();

  if (thinking) {
    return (
      <p className="flex items-center gap-2 text-base text-slate-700" role="status">
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-blue-500 motion-safe:animate-bounce" />
          <span className="h-2 w-2 rounded-full bg-violet-500 motion-safe:animate-bounce [animation-delay:120ms]" />
          <span className="h-2 w-2 rounded-full bg-cyan-500 motion-safe:animate-bounce [animation-delay:240ms]" />
        </span>
        {t('companion.thinking')}
      </p>
    );
  }

  if (!entry) {
    return <p className="text-base">{t('companion.live.empty')}</p>;
  }

  if (entry.kind === 'answer') {
    const actions = entry.result.suggestedActions.slice(0, 2);

    return (
      <div lang={entry.result.language}>
        {entry.basic ? (
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
            <FiAlertCircle aria-hidden="true" /> {t('companion.basicTag')}
          </p>
        ) : null}
        <div className="text-base leading-7 text-slate-800">
          <MarkdownMessage content={entry.text} />
        </div>
        {actions.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((action, index) => {
              const route = actionRoute(action.kind, { subject: entry.subject, topic: action.topic });

              return route ? (
                <Link key={`${action.kind}-${index}`} to={route} onClick={onLeave} className={TOOL_LINK}>
                  {action.label ?? t(actionLabelKey(action.kind))} <FiArrowRight aria-hidden="true" />
                </Link>
              ) : null;
            })}
          </div>
        ) : null}
      </div>
    );
  }

  if (entry.kind === 'handoff') {
    const { kind, topic } = entry.handoff;
    const route = actionRoute(kind, { subject: entry.handoff.subject || entry.subject, topic });

    return (
      <div>
        <p className="text-base leading-7 text-slate-800">{t(`mentor.handoff.${kind}`, { topic: topic ? t('mentor.handoff.onTopic', { topic }) : '' })}</p>
        {route ? (
          <Link to={route} onClick={onLeave} className={`${TOOL_LINK} mt-3`}>
            {t(`mentor.handoff.open.${kind}`)} <FiArrowRight aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    );
  }

  if (entry.kind === 'clarify') {
    return (
      <p className="text-base leading-7 text-slate-800">
        <span className="font-semibold">{t('mentor.clarify.title')}.</span> {t('mentor.clarify.too_vague')}
      </p>
    );
  }

  if (entry.kind === 'error') {
    return (
      <p className="flex items-start gap-2 text-base leading-7 text-rose-700" role="alert">
        <FiAlertCircle className="mt-1 shrink-0" aria-hidden="true" /> {entry.message || t('companion.error.generic')}
      </p>
    );
  }

  if (entry.kind === 'stopped') {
    return <p className="text-base text-slate-600">{t('companion.stopped')}</p>;
  }

  return null;
}

function LiveScreen() {
  const { t } = useT();
  const companion = useCompanion();
  const live = useLiveHimi();
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [opener] = useState(() => (typeof document === 'undefined' ? null : document.activeElement));
  const dialogRef = useRef(null);
  const robotWrapRef = useRef(null);
  const robotButtonRef = useRef(null);
  const typeInputRef = useRef(null);

  const { closeLive, entries, explanationLanguage, basic } = companion;
  const { phase, reason, micActive, robotState, thinking, speaking } = live;
  const loopOn = ['greeting', 'listening', 'thinking', 'speaking'].includes(phase);
  const showTyping = typing || phase === 'text';
  const stateLabel = t(robotStateLabelKey(robotState));

  const exit = useCallback(() => closeLive(), [closeLive]);
  useEscapeKey(exit, true);

  // Focus moves into the full-screen view, and returns to what opened it when it closes.
  useEffect(() => {
    robotButtonRef.current?.focus();

    return () => {
      if (opener?.isConnected) {
        opener.focus?.();
      }
    };
  }, [opener]);

  // The page behind must not scroll while the full-screen view is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (typing) {
      typeInputRef.current?.focus();
    }
  }, [typing]);

  const trapTab = (event) => {
    if (event.key !== 'Tab' || !dialogRef.current) {
      return;
    }

    const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter((element) => element.offsetParent !== null || element === document.activeElement);

    if (items.length === 0) {
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // HIMI's face drifts a little toward the pointer. Skipped entirely for reduced motion.
  const follow = (event) => {
    const element = robotWrapRef.current;

    if (!element || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const x = (event.clientX / window.innerWidth - 0.5) * 2;
    const y = (event.clientY / window.innerHeight - 0.5) * 2;
    element.style.transform = `translate(${(x * 10).toFixed(1)}px, ${(y * 8).toFixed(1)}px)`;
  };

  const submit = (event) => {
    event.preventDefault();
    const message = text.trim();

    if (!message || thinking) {
      return;
    }

    setText('');
    live.submitText(message);
  };

  const lastUser = [...entries].reverse().find((entry) => entry.kind === 'user');
  // Only the last exchange is on screen; while HIMI has not replied to the newest question, nothing stale is shown.
  const lastEntry = entries[entries.length - 1];
  const himiEntry = lastEntry && ['answer', 'handoff', 'clarify', 'error', 'stopped'].includes(lastEntry.kind) ? lastEntry : null;
  const youLine = micActive && live.interim ? live.interim : lastUser?.text ?? '';
  const robotAction = speaking || thinking || phase === 'greeting' ? 'interrupt' : phase === 'paused' || (phase === 'text' && live.canListen) ? 'talk' : 'idle';
  const robotLabel = t(robotAction === 'interrupt' ? 'companion.live.robotInterrupt' : robotAction === 'talk' ? 'companion.live.robotTalk' : 'companion.live.robotIdle');

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('companion.live.dialog')}
      onKeyDown={trapTab}
      onPointerMove={follow}
      className="force-light fixed inset-0 z-[75] flex flex-col overflow-hidden bg-slate-950 text-white print:hidden"
    >
      {/* Soft colour behind the robot. Decorative only. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_50%_30%,rgba(59,107,255,0.35),transparent),radial-gradient(40rem_30rem_at_85%_90%,rgba(34,211,160,0.22),transparent),radial-gradient(36rem_28rem_at_10%_85%,rgba(139,92,246,0.28),transparent)]" />

      <header className="relative z-10 flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <h2 className="text-lg font-black tracking-tight">{t('companion.live.title')}</h2>
        {basic ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-amber-950">
            <FiAlertCircle aria-hidden="true" /> {t('companion.live.basic')}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <div role="group" aria-label={t('companion.language')} className="inline-flex rounded-xl border border-white/25 bg-white/10 p-0.5">
            {LANGUAGES.map((language) => {
              const active = explanationLanguage === language.code;

              return (
                <button
                  key={language.code}
                  type="button"
                  lang={language.code}
                  aria-pressed={active}
                  onClick={() => live.changeLanguage(language.code)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/70 ${active ? 'bg-white text-slate-900' : 'text-white hover:bg-white/15'}`}
                >
                  {language.nativeLabel}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={exit} aria-label={t('companion.live.close')} title={t('companion.live.close')} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-lg transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/70">
            <FiX aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto px-4 pb-4 sm:px-6">
        <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3">
          <div ref={robotWrapRef} className="relative transition-transform duration-200 ease-out motion-reduce:transition-none">
            {/* Rings that breathe while HIMI listens or talks. Decorative: the state is also written below. */}
            {(robotState === 'listening' || robotState === 'speaking') ? (
              <>
                <span aria-hidden="true" className={`absolute inset-4 rounded-full border-2 motion-safe:animate-ping ${robotState === 'listening' ? 'border-rose-300/70' : 'border-cyan-300/70'}`} />
                <span aria-hidden="true" className={`absolute inset-0 rounded-full border motion-safe:animate-pulse ${robotState === 'listening' ? 'border-rose-300/40' : 'border-cyan-300/40'}`} />
              </>
            ) : null}
            <button
              ref={robotButtonRef}
              type="button"
              onClick={live.interrupt}
              aria-label={robotLabel}
              title={robotLabel}
              className="relative block h-[min(40dvh,72vw)] max-h-[26rem] min-h-[9rem] w-[min(40dvh,72vw)] max-w-[26rem] min-w-[9rem] rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/70"
            >
              <HimiRobot state={robotState} className="h-full w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.45)]" decorative />
            </button>
          </div>

          <p role="status" className="rounded-full bg-white/15 px-4 py-1.5 text-lg font-bold">
            {stateLabel}
          </p>
          <p className="min-h-6 max-w-xl text-center text-sm leading-6 text-slate-200">{hintKey(phase, reason) ? t(hintKey(phase, reason)) : ''}</p>
          {live.micError ? (
            <p role="alert" className="flex max-w-xl items-start gap-2 rounded-2xl bg-rose-100 px-4 py-2 text-sm text-rose-800">
              <FiAlertCircle className="mt-0.5 shrink-0" aria-hidden="true" /> {live.micError}
            </p>
          ) : null}
          {live.speechFailed ? (
            <p role="alert" className="flex max-w-xl items-start gap-2 rounded-2xl bg-amber-100 px-4 py-2 text-sm text-amber-900">
              <FiAlertCircle className="mt-0.5 shrink-0" aria-hidden="true" /> {t('companion.live.noVoice')}
            </p>
          ) : null}
        </div>

        <section aria-label={t('companion.transcript')} className="w-full max-w-2xl space-y-2">
          {youLine ? (
            <p className="rounded-2xl bg-white/10 px-4 py-2 text-sm text-slate-100" data-testid="live-you">
              <span className="font-semibold">{t('companion.live.youSaid')}:</span> {youLine}
              {micActive && live.interim ? <span className="sr-only"> ({t('companion.state.listening')})</span> : null}
            </p>
          ) : null}
          <div
            className={
              himiEntry || thinking
                ? 'max-h-[30dvh] overflow-y-auto rounded-3xl bg-white px-5 py-4 text-slate-800 shadow-xl'
                : 'px-5 py-2 text-center text-slate-200'
            }
            aria-live="polite"
            aria-busy={thinking}
            data-testid="live-himi"
          >
            <p className="sr-only">{t('companion.himiSays')}</p>
            <HimiCaption entry={himiEntry} thinking={thinking} onLeave={exit} />
          </div>
          {basic ? <p className="text-center text-xs leading-5 text-amber-100">{t('companion.live.basicNote')}</p> : null}
        </section>
      </main>

      <footer className="relative z-10 flex flex-col items-center gap-3 px-4 pb-5 pt-2 sm:px-6">
        {showTyping ? (
          <form onSubmit={submit} className="flex w-full max-w-2xl items-center gap-2">
            <label htmlFor="live-input" className="sr-only">
              {t('companion.input')}
            </label>
            <input
              id="live-input"
              ref={typeInputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={live.maxLength}
              placeholder={t('companion.placeholder')}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-2xl border border-white/25 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:ring-4 focus:ring-cyan-300/70"
            />
            <button
              type="submit"
              disabled={!text.trim() || thinking}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-blue-500 px-5 text-base font-bold text-white transition hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiSend aria-hidden="true" /> {t('companion.send')}
            </button>
          </form>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-3">
          {live.canListen ? (
            <button
              type="button"
              onClick={live.toggleMic}
              aria-label={loopOn ? t('companion.live.mute') : t('companion.live.unmute')}
              title={loopOn ? t('companion.live.mute') : t('companion.live.unmute')}
              className={loopOn ? ROUND_ACTIVE : ROUND_BUTTON}
            >
              {loopOn ? <FiMic aria-hidden="true" /> : <FiMicOff aria-hidden="true" />}
            </button>
          ) : null}

          {speaking || thinking ? (
            <button type="button" onClick={live.interrupt} aria-label={t('companion.live.stopHimi')} title={t('companion.live.stopHimi')} className={ROUND_BUTTON}>
              <FiSquare aria-hidden="true" />
            </button>
          ) : null}

          {live.canSpeakDevice ? (
            <button
              type="button"
              onClick={live.toggleSpeakReplies}
              aria-pressed={live.speakReplies}
              aria-label={t('companion.live.voiceReplies')}
              title={t('companion.live.voiceReplies')}
              className={ROUND_BUTTON}
            >
              {live.speakReplies ? <FiVolume2 aria-hidden="true" /> : <FiVolumeX aria-hidden="true" />}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setTyping((value) => !value)}
            aria-pressed={showTyping}
            disabled={phase === 'text'}
            aria-label={showTyping ? t('companion.live.hideTyping') : t('companion.live.typeInstead')}
            title={showTyping ? t('companion.live.hideTyping') : t('companion.live.typeInstead')}
            className={ROUND_BUTTON}
          >
            <FiEdit3 aria-hidden="true" />
          </button>
        </div>

        <p className="flex max-w-2xl items-center justify-center gap-2 text-center text-xs leading-5 text-slate-300">
          <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${micActive ? 'bg-rose-400 motion-safe:animate-pulse' : 'bg-slate-500'}`} />
          <span>{micActive ? t('companion.live.micOn') : t('companion.live.micOff')}</span>
        </p>
        <p className="max-w-2xl text-center text-xs leading-5 text-slate-400 [@media(max-height:520px)]:hidden">
          {t('companion.live.limits')}
        </p>
      </footer>
    </div>
  );
}

/**
 * HIMI's full-screen live conversation. It is mounted only while the student has asked for it, signed in, and
 * everything it does (microphone, reading aloud) stops when it closes.
 */
export default function LiveHimi() {
  const { live } = useCompanion();
  const { user } = useUser();

  if (!live || !user) {
    return null;
  }

  return <LiveScreen />;
}
