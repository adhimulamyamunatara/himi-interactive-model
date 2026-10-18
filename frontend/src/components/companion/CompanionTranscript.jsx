import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiAlertCircle, FiArrowRight, FiRefreshCw } from 'react-icons/fi';
import MarkdownMessage from '../chat/MarkdownMessage';
import ListenButton from '../voice/ListenButton';
import { companionSpeechId } from '../../context/CompanionContext';
import { useT } from '../../i18n/I18nContext';
import { MEMBER_PAGES, pageLabel } from '../../utils/navigation';
import { actionLabelKey, actionRoute } from '../../utils/tutor';

const HIMI_BUBBLE = 'rounded-3xl rounded-bl-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm';
const CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:opacity-60';

function Said({ children }) {
  const { t } = useT();

  return (
    <div className="max-w-[92%]">
      <p className="sr-only">{t('companion.himiSays')}</p>
      {children}
    </div>
  );
}

function ToolLink({ to, onNavigate, children }) {
  return (
    <Link to={to} onClick={onNavigate} className={CHIP}>
      {children} <FiArrowRight aria-hidden="true" />
    </Link>
  );
}

function AnswerEntry({ entry, isLatest, voiceEnabled, onAsk, onNavigate, busy }) {
  const { t } = useT();
  const { result } = entry;

  return (
    <Said>
      <div className={`${HIMI_BUBBLE} group`} lang={result.language}>
        <MarkdownMessage content={entry.text} />
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {voiceEnabled ? <ListenButton messageId={companionSpeechId(entry.id)} text={entry.text} alwaysVisible /> : null}
        </div>
      </div>

      {isLatest && result.plan ? (
        <details className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-700">{t('mentor.plan')}</summary>
          <p className="mt-2 text-slate-600">
            <span className="font-semibold text-slate-800">{t('mentor.goal')}:</span> {result.plan.goal}
          </p>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-slate-600">
            {result.plan.steps.map((step, index) => (
              <li key={`${step.title}-${index}`}>
                <span className="font-semibold text-slate-800">{step.title}.</span> {step.detail}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {isLatest && result.clarifyingQuestion ? <p className="mt-2 rounded-2xl bg-violet-50 px-4 py-2 text-sm text-violet-900">{result.clarifyingQuestion}</p> : null}

      {isLatest && result.suggestedActions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t('mentor.actions')}>
          {result.suggestedActions.map((action, index) => {
            const route = actionRoute(action.kind, { subject: entry.subject, topic: action.topic });

            return route ? (
              <ToolLink key={`${action.kind}-${index}`} to={route} onNavigate={onNavigate}>
                {action.label ?? t(actionLabelKey(action.kind))}
              </ToolLink>
            ) : null;
          })}
        </div>
      ) : null}

      {isLatest && result.followUps.length > 0 ? (
        <div className="mt-2" role="group" aria-label={t('mentor.followUps')}>
          <p className="mb-1 text-xs font-semibold text-slate-600">{t('mentor.followUps')}</p>
          <div className="flex flex-wrap gap-2">
            {result.followUps.map((question) => (
              <button key={question} type="button" className={CHIP} disabled={busy} onClick={() => onAsk(question)}>
                {question}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </Said>
  );
}

function HandoffEntry({ entry, onNavigate }) {
  const { t } = useT();
  const { kind, topic } = entry.handoff;
  const subject = entry.handoff.subject || entry.subject;
  const route = actionRoute(kind, { subject, topic });
  const onTopic = topic ? t('mentor.handoff.onTopic', { topic }) : '';

  return (
    <Said>
      <div className={HIMI_BUBBLE}>
        <p>{t(`mentor.handoff.${kind}`, { topic: onTopic })}</p>
        {route ? (
          <div className="mt-3">
            <ToolLink to={route} onNavigate={onNavigate}>
              {t(`mentor.handoff.open.${kind}`)}
            </ToolLink>
          </div>
        ) : null}
      </div>
    </Said>
  );
}

function OpenEntry({ entry, onNavigate }) {
  const { t } = useT();
  const page = MEMBER_PAGES.find((candidate) => candidate.to === entry.to);

  return (
    <Said>
      <div className={HIMI_BUBBLE}>
        <p>{t('companion.opening', { page: page ? pageLabel(page, t, { footer: true }) : entry.to })}</p>
        <div className="mt-3">
          <ToolLink to={entry.to} onNavigate={onNavigate}>
            {t('companion.openAgain')}
          </ToolLink>
        </div>
      </div>
    </Said>
  );
}

function ErrorEntry({ entry, onRetry, busy }) {
  const { t } = useT();
  const detail = entry.errorKind === 'invalid' ? t('mentor.error.invalid') : entry.message || t('companion.error.generic');

  return (
    <Said>
      <div role="alert" className="rounded-3xl rounded-bl-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800">
        <p className="flex items-start gap-2">
          <FiAlertCircle className="mt-1 shrink-0" aria-hidden="true" /> <span>{detail}</span>
        </p>
        <button type="button" onClick={onRetry} disabled={busy} className={`${CHIP} mt-3 border-rose-200 bg-white text-rose-700 hover:bg-rose-100 focus-visible:ring-rose-200`}>
          <FiRefreshCw aria-hidden="true" /> {t('companion.retry')}
        </button>
      </div>
    </Said>
  );
}

function StoppedEntry({ onRetry, busy }) {
  const { t } = useT();

  return (
    <Said>
      <div className={HIMI_BUBBLE}>
        <p>{t('companion.stopped')}</p>
        <button type="button" onClick={onRetry} disabled={busy} className={`${CHIP} mt-3`}>
          <FiRefreshCw aria-hidden="true" /> {t('companion.retry')}
        </button>
      </div>
    </Said>
  );
}

function ClarifyEntry() {
  const { t } = useT();

  return (
    <Said>
      <div className={HIMI_BUBBLE}>
        <p className="font-semibold text-slate-900">{t('mentor.clarify.title')}</p>
        <p className="mt-1">{t('mentor.clarify.too_vague')}</p>
      </div>
    </Said>
  );
}

/**
 * The conversation so far. It is a polite live region, so a new reply is announced without stealing focus,
 * and it keeps the newest line in view (a long answer is scrolled to its start so it can be read from the top).
 */
export default function CompanionTranscript({ entries, thinking, greeting, voiceEnabled, busy, onAsk, onRetry, onCancel, onNavigate, className = '' }) {
  const { t } = useT();
  const scrollRef = useRef(null);
  const lastId = entries[entries.length - 1]?.id;
  const latestAnswerId = [...entries].reverse().find((entry) => entry.kind === 'answer')?.id;

  useEffect(() => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    const last = entries[entries.length - 1];
    const element = last?.kind === 'answer' ? container.querySelector(`[data-entry="${last.id}"]`) : null;

    if (element) {
      const offset = element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 8;
      container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
      return;
    }

    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [lastId, thinking, entries]);

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-label={t('companion.transcript')}
      aria-live="polite"
      aria-busy={thinking}
      className={`scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 ${className}`}
    >
      {entries.length === 0 ? (
        <Said>
          <div className={HIMI_BUBBLE}>{greeting}</div>
        </Said>
      ) : null}

      {entries.map((entry) => (
        <div key={entry.id} data-entry={entry.id}>
          {entry.kind === 'user' ? (
            <div className="flex justify-end">
              <p className="max-w-[88%] whitespace-pre-wrap break-words rounded-3xl rounded-br-lg bg-gradient-to-br from-blue-600 to-violet-600 px-4 py-2.5 text-sm leading-6 text-white shadow-sm">
                <span className="sr-only">{t('companion.you')}: </span>
                {entry.text}
              </p>
            </div>
          ) : null}
          {entry.kind === 'answer' ? (
            <AnswerEntry entry={entry} isLatest={entry.id === latestAnswerId && entry.id === lastId} voiceEnabled={voiceEnabled} onAsk={onAsk} onNavigate={onNavigate} busy={busy} />
          ) : null}
          {entry.kind === 'handoff' ? <HandoffEntry entry={entry} onNavigate={onNavigate} /> : null}
          {entry.kind === 'clarify' ? <ClarifyEntry /> : null}
          {entry.kind === 'open' ? <OpenEntry entry={entry} onNavigate={onNavigate} /> : null}
          {entry.kind === 'error' ? <ErrorEntry entry={entry} onRetry={onRetry} busy={busy} /> : null}
          {entry.kind === 'stopped' ? <StoppedEntry onRetry={onRetry} busy={busy} /> : null}
        </div>
      ))}

      {thinking ? (
        <div role="status" className="flex items-center gap-3 text-sm text-slate-600">
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500 motion-reduce:animate-none" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-violet-500 [animation-delay:120ms] motion-reduce:animate-none" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500 [animation-delay:240ms] motion-reduce:animate-none" />
          </span>
          {t('companion.thinking')}
          <button type="button" onClick={onCancel} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 underline hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">
            {t('companion.stop')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
