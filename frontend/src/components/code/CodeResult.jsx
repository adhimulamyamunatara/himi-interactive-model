import { useState } from 'react';
import { FiAlertTriangle, FiCheck, FiChevronDown, FiCopy, FiInfo, FiSlash } from 'react-icons/fi';
import MarkdownMessage from '../chat/MarkdownMessage';
import Badge from '../common/Badge';
import Card from '../common/Card';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { useT } from '../../i18n/I18nContext';
import { codeLine } from '../../utils/codeAssist';

const SEVERITY_TONES = { info: 'blue', warning: 'amber', error: 'rose' };

function Findings({ findings, code }) {
  const { t } = useT();

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">{t('code.result.findings')}</h2>
      <ul className="mt-4 space-y-4">
        {findings.map((finding, index) => {
          // A line number the code does not have is ignored rather than shown.
          const source = finding.line ? codeLine(code, finding.line) : null;
          const lineNumber = source === null ? null : finding.line;

          return (
            <li key={`${finding.title}-${index}`} className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                <Badge tone={SEVERITY_TONES[finding.severity]}>{t(`code.severity.${finding.severity}`)}</Badge>
                {lineNumber ? <Badge tone="slate">{t('code.result.line', { line: lineNumber })}</Badge> : null}
                <span className="min-w-0 break-words">{finding.title}</span>
              </p>
              {source ? (
                <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 px-3 py-2 text-xs text-slate-100">
                  <code translate="no">{source}</code>
                </pre>
              ) : null}
              <p className="mt-2 text-sm leading-6 text-slate-600">{finding.detail}</p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Hints({ hints, progressive }) {
  const { t } = useT();
  const [shown, setShown] = useState(progressive ? 1 : hints.length);

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">{t('code.result.hints')}</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
        {hints.slice(0, shown).map((hint, index) => (
          <li key={`${hint}-${index}`}>{hint}</li>
        ))}
      </ol>
      {shown < hints.length ? (
        <button
          type="button"
          onClick={() => setShown((count) => count + 1)}
          className="mt-4 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:border-blue-200 hover:bg-slate-50"
        >
          <FiChevronDown aria-hidden="true" /> {t('code.result.nextHint')}
        </button>
      ) : null}
    </Card>
  );
}

function ImprovedCode({ code }) {
  const { t } = useT();
  const { copied, copy } = useCopyToClipboard();

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">{t('code.result.improved')}</h2>
        <button
          type="button"
          onClick={() => copy(code)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          {copied ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />} {copied ? t('common.copied') : t('code.result.copyCode')}
        </button>
      </div>
      <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-slate-900 p-4 text-xs leading-5 text-slate-100">
        <code translate="no">{code}</code>
      </pre>
    </Card>
  );
}

/** What the Coding Assistant returned. Everything is labelled as analysis: HIMI never runs the code. */
export default function CodeResult({ result, code, onFollowUp }) {
  const { t } = useT();

  return (
    <div className="space-y-5">
      <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
        <FiSlash className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          <strong>{t('code.result.badge')}.</strong> {t('code.notice')}
        </span>
      </p>

      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">{t('code.result.summary')}</h2>
        <div className="mt-3" lang={result.language}>
          <MarkdownMessage content={result.summary} />
        </div>
        {result.review ? (
          <p className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
            <FiInfo className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {result.review.passed ? t('code.review.passed') : t('code.review.flagged', { issues: result.review.issues.join('; ') })}{' '}
              {t('code.review.disclaimer')}
            </span>
          </p>
        ) : null}
      </Card>

      {result.findings.length > 0 ? <Findings findings={result.findings} code={code} /> : null}

      {result.hints.length > 0 ? <Hints key={result.requestId} hints={result.hints} progressive={result.task === 'hints'} /> : null}

      {result.complexity ? (
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">{t('code.result.complexity')}</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-blue-50 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-blue-700">{t('code.result.time')}</dt>
              <dd className="mt-1 font-mono text-lg font-bold text-slate-900" translate="no">{result.complexity.time}</dd>
            </div>
            <div className="rounded-2xl bg-violet-50 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-violet-700">{t('code.result.space')}</dt>
              <dd className="mt-1 font-mono text-lg font-bold text-slate-900" translate="no">{result.complexity.space}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm leading-6 text-slate-600">{result.complexity.explanation}</p>
        </Card>
      ) : null}

      {result.testCases.length > 0 ? (
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">{t('code.result.tests')}</h2>
          <ul className="mt-4 space-y-3">
            {result.testCases.map((testCase, index) => (
              <li key={`${testCase.name}-${index}`} className="rounded-2xl border border-slate-200 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <FiAlertTriangle className="text-amber-600" aria-hidden="true" /> {testCase.name}
                </p>
                <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="font-semibold text-slate-600">{t('code.result.input')}</dt>
                    <dd className="mt-1 overflow-x-auto rounded-lg bg-slate-100 px-2 py-1 font-mono text-slate-900" translate="no">{testCase.input || '—'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="font-semibold text-slate-600">{t('code.result.expected')}</dt>
                    <dd className="mt-1 overflow-x-auto rounded-lg bg-slate-100 px-2 py-1 font-mono text-slate-900" translate="no">{testCase.expectedOutput || '—'}</dd>
                  </div>
                </dl>
                {testCase.why ? <p className="mt-2 text-xs leading-5 text-slate-600">{testCase.why}</p> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {result.improvedCode ? <ImprovedCode code={result.improvedCode} /> : null}

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
    </div>
  );
}
