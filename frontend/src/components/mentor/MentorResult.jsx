import { FiArrowRight, FiCheckCircle, FiCpu, FiHelpCircle, FiInfo, FiMessageCircle } from 'react-icons/fi';
import MarkdownMessage from '../chat/MarkdownMessage';
import Badge from '../common/Badge';
import Button from '../common/Button';
import Card from '../common/Card';
import ListenButton from '../voice/ListenButton';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { useT } from '../../i18n/I18nContext';
import { actionLabelKey, actionRoute } from '../../utils/tutor';

const STEP_TONES = { learn: 'blue', example: 'purple', practice: 'emerald', check: 'amber' };

function PlanCard({ plan }) {
  const { t } = useT();

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">{t('mentor.plan')}</h2>
      <p className="mt-1 text-sm text-slate-600">
        <span className="font-semibold text-slate-800">{t('mentor.goal')}:</span> {plan.goal}
      </p>
      <ol className="mt-4 space-y-3">
        {plan.steps.map((step, index) => (
          <li key={`${step.title}-${index}`} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-gradient text-xs font-bold text-white"
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                {step.title}
                <Badge tone={STEP_TONES[step.kind] ?? 'blue'}>{t(`mentor.step.${step.kind}`)}</Badge>
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function ReviewNote({ review }) {
  const { t } = useT();

  if (!review) {
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
      <p className="flex items-start gap-2">
        <FiInfo className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          {review.passed ? t('mentor.review.passed') : t('mentor.review.flagged', { issues: review.issues.join('; ') })}{' '}
          {t('mentor.review.disclaimer')}
        </span>
      </p>
    </div>
  );
}

function TraceDetails({ result }) {
  const { t } = useT();
  const agentLabel = (agent) => {
    const label = t(`mentor.agent.${agent}`);
    return label === `mentor.agent.${agent}` ? agent : label;
  };

  return (
    <details className="group rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold text-slate-700">
        <FiCpu aria-hidden="true" /> {t('mentor.trace.title')}
      </summary>
      <p className="mt-3 text-xs text-slate-500">{t('mentor.trace.calls', { count: result.modelCalls })}</p>
      <ul className="mt-2 space-y-1 text-xs text-slate-600">
        {result.trace.map((entry, index) => (
          <li key={`${entry.agent}-${entry.action}-${index}`} className="flex flex-wrap gap-x-2">
            <span className="font-semibold">{agentLabel(entry.agent)}</span>
            <span>{entry.action}</span>
            <span className="text-slate-500">
              {t(`mentor.trace.${entry.status}`)} · {entry.ms} ms
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function AnswerCard({ result, voiceEnabled }) {
  const { t } = useT();
  const { copied, copy } = useCopyToClipboard();

  return (
    <Card className="group p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">{t('mentor.answer')}</h2>
        <div className="flex items-center gap-1">
          {voiceEnabled ? <ListenButton messageId={`mentor-${result.requestId}`} text={result.answer} /> : null}
          <button
            type="button"
            onClick={() => copy(result.answer)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            {copied ? t('common.copied') : t('mentor.copyAnswer')}
          </button>
        </div>
      </div>
      <div className="mt-3" lang={result.language}>
        <MarkdownMessage content={result.answer} />
      </div>
      {result.clarifyingQuestion ? (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-900">
          <FiHelpCircle className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">{t('mentor.modelQuestion')}:</span> {result.clarifyingQuestion}
          </span>
        </p>
      ) : null}
      <ReviewNote review={result.review} />
    </Card>
  );
}

/** Everything the tutor returned for one question: a plan, an answer, or a request for more detail / a handoff. */
export default function MentorResult({ result, subject, topic, voiceEnabled, onFollowUp }) {
  const { t } = useT();

  if (result.outcome === 'clarify') {
    return (
      <Card className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <FiMessageCircle aria-hidden="true" /> {t('mentor.clarify.title')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t(`mentor.clarify.${result.clarify.reason}`)}</p>
      </Card>
    );
  }

  if (result.outcome === 'handoff') {
    const { kind, topic: handoffTopic } = result.handoff;
    const route = actionRoute(kind, { subject: result.handoff.subject || subject, topic: handoffTopic ?? topic });
    const onTopic = handoffTopic ? t('mentor.handoff.onTopic', { topic: handoffTopic }) : '';

    return (
      <Card className="p-5 sm:p-6">
        <p className="text-sm leading-6 text-slate-700">{t(`mentor.handoff.${kind}`, { topic: onTopic })}</p>
        <Button className="mt-4" to={route}>
          {t(`mentor.handoff.open.${kind}`)} <FiArrowRight aria-hidden="true" />
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PlanCard plan={result.plan} />
      <AnswerCard result={result} voiceEnabled={voiceEnabled} />

      {result.suggestedActions.length > 0 ? (
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">{t('mentor.actions')}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.suggestedActions.map((action) => (
              <Button
                key={action.kind}
                variant="secondary"
                size="sm"
                to={actionRoute(action.kind, { subject, topic: action.topic ?? topic })}
              >
                <FiCheckCircle aria-hidden="true" /> {action.label ?? t(actionLabelKey(action.kind))}
              </Button>
            ))}
          </div>
        </Card>
      ) : null}

      {result.followUps.length > 0 ? (
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">{t('mentor.followUps')}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.followUps.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => onFollowUp(question)}
                className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-left text-sm font-medium text-blue-800 transition hover:border-blue-200 hover:bg-blue-100"
              >
                {question}
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      <TraceDetails result={result} />
    </div>
  );
}
