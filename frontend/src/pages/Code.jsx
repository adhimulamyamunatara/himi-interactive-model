import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FiSearch, FiSquare, FiTrash2 } from 'react-icons/fi';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Input from '../components/common/Input';
import SegmentedControl from '../components/common/SegmentedControl';
import Select from '../components/common/Select';
import CodeResult from '../components/code/CodeResult';
import { usePreferences } from '../hooks/usePreferences';
import { useRequestSession } from '../hooks/useRequestSession';
import { useT } from '../i18n/I18nContext';
import { assistCode, describeCodeError } from '../services/codeService';
import {
  buildCodeRequest,
  CODE_LANGUAGES,
  CODE_TASKS,
  countLines,
  MAX_CODE_CHARS,
  MAX_CODE_LINES,
  MAX_ERROR_CHARS,
  MAX_QUESTION_CHARS,
  validateCodeInput
} from '../utils/codeAssist';

const HELP_OPTIONS = ['hint', 'guided', 'full'];

export default function Code() {
  const { t } = useT();
  const { preferences, update } = usePreferences();
  const session = useRequestSession(assistCode, describeCodeError);

  const [code, setCode] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('python');
  const [task, setTask] = useState('explain');
  const [question, setQuestion] = useState('');
  const [errorOutput, setErrorOutput] = useState('');
  const [touched, setTouched] = useState(false);
  // The code the shown analysis refers to, so line references stay correct if the student keeps editing.
  const [analysedCode, setAnalysedCode] = useState('');
  const questionRef = useRef(null);
  const resultRef = useRef(null);

  const loading = session.status === 'loading';
  const validation = validateCodeInput(code);
  const showError = touched && validation;

  const run = async (event) => {
    event?.preventDefault?.();
    setTouched(true);

    if (validation || loading) {
      return;
    }

    setAnalysedCode(code);
    const outcome = await session.send(
      buildCodeRequest({ code, codeLanguage, task, question, errorOutput, language: preferences.explanationLanguage, helpMode: preferences.helpMode })
    );

    if (outcome.started && !outcome.reason) {
      resultRef.current?.focus();
    }
  };

  const clear = () => {
    session.reset();
    setCode('');
    setQuestion('');
    setErrorOutput('');
    setTouched(false);
    setAnalysedCode('');
  };

  const validationText = showError
    ? t(`code.validation.${validation}`, { max: validation === 'too_many_lines' ? MAX_CODE_LINES : MAX_CODE_CHARS })
    : null;

  return (
    <motion.section className="section-shell py-10 lg:py-14" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="mb-8 max-w-3xl">
        <p className="eyebrow">{t('code.eyebrow')}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{t('code.title')}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t('code.subtitle')}</p>
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900" role="note">
          {t('code.notice')}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] lg:items-start">
        <form onSubmit={run} className="section-card min-w-0 space-y-5 p-5 sm:p-6" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label={t('code.language')} value={codeLanguage} onChange={(event) => setCodeLanguage(event.target.value)} disabled={loading}>
              {CODE_LANGUAGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <Select label={t('code.task')} value={task} onChange={(event) => setTask(event.target.value)} disabled={loading}>
              {CODE_TASKS.map((item) => (
                <option key={item} value={item}>
                  {t(`code.task.${item}`)}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="code-input" className="text-sm font-medium text-slate-700">
              {t('code.code')}
            </label>
            <textarea
              id="code-input"
              rows={14}
              wrap="off"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              translate="no"
              value={code}
              placeholder={t('code.codePlaceholder')}
              onChange={(event) => setCode(event.target.value)}
              onBlur={() => code && setTouched(true)}
              disabled={loading}
              aria-invalid={showError ? 'true' : undefined}
              aria-describedby="code-counter code-validation"
              className="scrollbar-thin w-full resize-y overflow-auto whitespace-pre force-light rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 font-mono text-xs leading-5 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span id="code-counter">{t('code.counter', { lines: countLines(code), chars: code.length, max: MAX_CODE_CHARS })}</span>
              <span id="code-validation" role="alert" className="font-medium text-rose-600">
                {validationText}
              </span>
            </div>
          </div>

          <Input
            label={t('code.question')}
            value={question}
            maxLength={MAX_QUESTION_CHARS}
            placeholder={t('code.questionPlaceholder')}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={loading}
            ref={questionRef}
          />

          <div className="flex flex-col gap-2">
            <label htmlFor="code-error" className="text-sm font-medium text-slate-700">
              {t('code.errorOutput')}
            </label>
            <textarea
              id="code-error"
              rows={3}
              spellCheck={false}
              translate="no"
              value={errorOutput}
              maxLength={MAX_ERROR_CHARS}
              placeholder={t('code.errorPlaceholder')}
              onChange={(event) => setErrorOutput(event.target.value)}
              disabled={loading}
              className="w-full resize-y rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 font-mono text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
            />
          </div>

          <SegmentedControl
            legend={t('mentor.helpMode')}
            options={HELP_OPTIONS.map((mode) => ({ value: mode, label: t(`mentor.help.${mode}`) }))}
            value={preferences.helpMode}
            onChange={(value) => update({ helpMode: value })}
            disabled={loading}
          />

          <SegmentedControl
            legend={t('language.explanation')}
            options={[
              { value: 'en', label: 'English' },
              { value: 'te', label: 'తెలుగు' }
            ]}
            value={preferences.explanationLanguage}
            onChange={(value) => update({ explanationLanguage: value })}
            disabled={loading}
          />

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={loading || !code.trim()}>
              <FiSearch aria-hidden="true" /> {t('code.analyse')}
            </Button>
            {loading ? (
              <Button type="button" variant="secondary" onClick={session.cancel}>
                <FiSquare aria-hidden="true" /> {t('mentor.stop')}
              </Button>
            ) : null}
            {!loading && (code || session.status !== 'idle') ? (
              <Button type="button" variant="ghost" onClick={clear}>
                <FiTrash2 aria-hidden="true" /> {t('code.clear')}
              </Button>
            ) : null}
          </div>
        </form>

        <div aria-live="polite" aria-busy={loading} className="min-w-0">
          {session.status === 'idle' ? <EmptyState title={t('code.emptyTitle')} description={t('code.emptyText')} /> : null}

          {loading ? (
            <Card className="p-6" role="status">
              <p className="text-sm font-semibold text-slate-800">{t('code.analysing')}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-1/3 animate-soft-pulse rounded-full bg-learn-gradient" />
              </div>
            </Card>
          ) : null}

          {session.status === 'error' ? (
            <ErrorState
              title={t('code.error.title')}
              description={session.error?.kind === 'invalid' ? t('code.error.invalid') : `${session.error?.message ?? ''} ${t('mentor.error.fallback')}`.trim()}
              actionLabel={t('common.tryAgain')}
              onAction={run}
            />
          ) : null}

          {session.status === 'success' && session.result ? (
            <div ref={resultRef} tabIndex={-1} className="outline-none">
              <CodeResult
                result={session.result}
                code={analysedCode}
                onFollowUp={(followUp) => {
                  setQuestion(followUp);
                  questionRef.current?.focus();
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}
