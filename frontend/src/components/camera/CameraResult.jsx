import { FiAlertTriangle, FiCheck, FiCopy, FiInfo } from 'react-icons/fi';
import MarkdownMessage from '../chat/MarkdownMessage';
import Badge from '../common/Badge';
import Card from '../common/Card';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { useT } from '../../i18n/I18nContext';

const KIND_TONES = { notes: 'blue', textbook: 'blue', diagram: 'violet', code: 'slate', problem: 'amber', other: 'slate', not_study_material: 'rose' };

/**
 * The analysis of one photo. Everything from the server is shown as text or sanitised Markdown, never as markup,
 * and the AI note and retention statement stay visible next to it.
 */
export default function CameraResult({ result, onFollowUp }) {
  const { t } = useT();
  const { copied, copy } = useCopyToClipboard();
  const notStudy = result.kind === 'not_study_material';

  return (
    <div className="space-y-4" lang={result.language}>
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={KIND_TONES[result.kind] ?? 'slate'}>{t(`camera.kind.${result.kind}`)}</Badge>
          {result.title ? <h2 className="min-w-0 break-words text-lg font-bold text-slate-900">{result.title}</h2> : null}
        </div>

        {result.legibility !== 'clear' ? (
          <p role="status" className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <FiAlertTriangle className="mt-0.5 shrink-0" aria-hidden="true" /> {t(`camera.legibility.${result.legibility}`)}
          </p>
        ) : null}

        {result.whatIsShown && !notStudy ? (
          <>
            <h3 className="mt-4 text-sm font-semibold text-slate-700">{t('camera.result.shown')}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-700">{result.whatIsShown}</p>
          </>
        ) : null}

        <h3 className="mt-4 text-sm font-semibold text-slate-700">{t('camera.result.explanation')}</h3>
        <div className="mt-1">
          <MarkdownMessage content={result.explanation} />
        </div>
      </Card>

      {result.keyPoints.length > 0 ? (
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">{t('camera.result.points')}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {result.keyPoints.map((point, index) => (
              <li key={`${point}-${index}`}>{point}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {result.extractedText ? (
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">{t('camera.result.text')}</h2>
            <button
              type="button"
              onClick={() => copy(result.extractedText)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
            >
              {copied ? <FiCheck aria-hidden="true" className="text-emerald-600" /> : <FiCopy aria-hidden="true" />} {copied ? t('common.copied') : t('camera.result.copyText')}
            </button>
          </div>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-800">{result.extractedText}</pre>
          <p className="mt-2 text-xs leading-5 text-slate-600">{t('camera.result.textNote')}</p>
        </Card>
      ) : null}

      {result.followUps.length > 0 ? (
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">{t('camera.result.followUps')}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.followUps.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => onFollowUp(question)}
                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-left text-xs font-medium text-blue-800 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
              >
                {question}
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      <p className="flex items-start gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-xs leading-5 text-slate-700">
        <FiInfo className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          {t('camera.result.aiNote')} {t('camera.result.notRetained')}
          {result.review && !result.review.passed ? ` ${result.review.issues.join(' ')}` : ''}
        </span>
      </p>
    </div>
  );
}
