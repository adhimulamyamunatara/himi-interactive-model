import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { FiCheck, FiClipboard, FiDownload, FiEdit3, FiInfo, FiSquare } from 'react-icons/fi';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Input from '../components/common/Input';
import SegmentedControl from '../components/common/SegmentedControl';
import Select from '../components/common/Select';
import DiagramView from '../components/diagrams/DiagramView';
import MarkdownMessage from '../components/chat/MarkdownMessage';
import { useChat } from '../context/ChatContext';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { usePreferences } from '../hooks/usePreferences';
import { useRequestSession } from '../hooks/useRequestSession';
import { useT } from '../i18n/I18nContext';
import { describeDiagramError, generateDiagram } from '../services/diagramService';
import { createId } from '../utils/chatConversations';
import {
  buildDiagramRequest,
  buildSvgString,
  DIAGRAM_TYPES,
  diagramToText,
  diagramToWhiteboardShapes,
  fitsOnBoard,
  layoutDiagram,
  MAX_DETAILS_CHARS,
  MAX_TOPIC_CHARS
} from '../utils/diagram';
import { SUBJECTS } from '../utils/subjects';
import { loadWhiteboard, saveWhiteboard } from '../utils/whiteboardStorage';

const fileName = (title) => `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'diagram'}.svg`;

function DiagramResult({ diagram }) {
  const { t } = useT();
  const { copied, copy } = useCopyToClipboard();
  const layout = useMemo(() => layoutDiagram(diagram), [diagram]);
  // 'idle' | 'confirm' | 'added' | an error key
  const [boardState, setBoardState] = useState('idle');
  const text = useMemo(() => diagramToText(diagram), [diagram]);

  const downloadSvg = () => {
    const svg = buildSvgString(layout, { title: diagram.title, description: diagram.explanation });
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName(diagram.title);
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const addToBoard = (confirmed) => {
    const board = loadWhiteboard();

    if (board.issue === 'unavailable') {
      setBoardState('boardSaveFailed');
      return;
    }

    if (board.shapes.length > 0 && !confirmed) {
      setBoardState('confirm');
      return;
    }

    const converted = diagramToWhiteboardShapes(diagram, createId);

    if (!converted.ok) {
      setBoardState('boardTooLarge');
      return;
    }

    if (!fitsOnBoard(board.shapes, converted.shapes)) {
      setBoardState('boardFull');
      return;
    }

    setBoardState(saveWhiteboard([...board.shapes, ...converted.shapes]).ok ? 'added' : 'boardSaveFailed');
  };

  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">{diagram.title}</h2>
        <figure className="mt-4" aria-label={t('diagrams.figureLabel', { title: diagram.title })}>
          <div className="scrollbar-thin force-light overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">
            <DiagramView layout={layout} title={diagram.title} description={diagram.explanation} />
          </div>
        </figure>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => copy(text)}>
            {copied ? <FiCheck aria-hidden="true" /> : <FiClipboard aria-hidden="true" />} {copied ? t('common.copied') : t('diagrams.copyText')}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={downloadSvg}>
            <FiDownload aria-hidden="true" /> {t('diagrams.downloadSvg')}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => addToBoard(false)}>
            <FiEdit3 aria-hidden="true" /> {t('diagrams.addToBoard')}
          </Button>
        </div>

        <div aria-live="polite" className="mt-3 text-sm">
          {boardState === 'confirm' ? (
            <div role="alertdialog" aria-label={t('diagrams.addToBoard')} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <p>{t('diagrams.boardConfirm')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => addToBoard(true)}>
                  {t('diagrams.boardContinue')}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setBoardState('idle')}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : null}
          {boardState === 'added' ? (
            <p className="text-emerald-800">
              {t('diagrams.boardAdded')}{' '}
              <Link to="/whiteboard" className="font-semibold underline">
                {t('diagrams.openBoard')}
              </Link>
            </p>
          ) : null}
          {['boardTooLarge', 'boardFull', 'boardSaveFailed'].includes(boardState) ? (
            <p role="alert" className="text-rose-700">
              {t(`diagrams.${boardState}`)}
            </p>
          ) : null}
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">{t('diagrams.explanation')}</h2>
        <div className="mt-3" lang={diagram.language}>
          <MarkdownMessage content={diagram.explanation} />
        </div>
        <ul className="mt-4 space-y-1 text-sm text-slate-600">
          {diagram.edges.map((edge) => {
            const label = (id) => diagram.nodes.find((node) => node.id === id)?.label;
            return (
              <li key={`${edge.from}>${edge.to}`}>
                {label(edge.from)} → {label(edge.to)}
                {edge.label ? ` (${edge.label})` : ''}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          <FiInfo className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {diagram.review && !diagram.review.passed ? t('mentor.review.flagged', { issues: diagram.review.issues.join('; ') }) + ' ' : ''}
            {t('diagrams.aiNote')} {t('mentor.review.disclaimer')}
          </span>
        </p>
      </Card>
    </div>
  );
}

export default function Diagrams() {
  const { t } = useT();
  const { selectedSubject } = useChat();
  const { preferences, update } = usePreferences();
  const session = useRequestSession(generateDiagram, describeDiagramError);
  const [searchParams] = useSearchParams();

  const linkedSubject = searchParams.get('subject');
  const [subject, setSubject] = useState(SUBJECTS.includes(linkedSubject) ? linkedSubject : selectedSubject);
  const [topic, setTopic] = useState((searchParams.get('topic') ?? '').slice(0, MAX_TOPIC_CHARS));
  const [diagramType, setDiagramType] = useState('flowchart');
  const [details, setDetails] = useState('');
  const [touched, setTouched] = useState(false);

  const loading = session.status === 'loading';
  const topicError = touched && !topic.trim() ? t('diagrams.validation.topic') : undefined;

  const submit = (event) => {
    event?.preventDefault?.();
    setTouched(true);

    if (!topic.trim() || loading) {
      return;
    }

    session.send(buildDiagramRequest({ topic, subject, diagramType, details, language: preferences.explanationLanguage }));
  };

  return (
    <motion.section className="section-shell py-10 lg:py-14" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="mb-8 max-w-3xl">
        <p className="eyebrow">{t('diagrams.eyebrow')}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{t('diagrams.title')}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t('diagrams.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <form onSubmit={submit} className="section-card space-y-5 p-5 sm:p-6 lg:sticky lg:top-24" noValidate>
          <Select label={t('common.subject')} value={subject} onChange={(event) => setSubject(event.target.value)} disabled={loading}>
            {SUBJECTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>

          <Input
            label={t('diagrams.topic')}
            value={topic}
            maxLength={MAX_TOPIC_CHARS}
            placeholder={t('diagrams.topicPlaceholder')}
            error={topicError}
            onChange={(event) => setTopic(event.target.value)}
            disabled={loading}
          />

          <SegmentedControl
            legend={t('diagrams.type')}
            options={DIAGRAM_TYPES.map((type) => ({ value: type, label: t(`diagrams.type.${type}`) }))}
            value={diagramType}
            onChange={setDiagramType}
            disabled={loading}
          />

          <Input
            label={t('diagrams.details')}
            value={details}
            maxLength={MAX_DETAILS_CHARS}
            placeholder={t('diagrams.detailsPlaceholder')}
            onChange={(event) => setDetails(event.target.value)}
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
            <Button type="submit" disabled={loading}>
              {t('diagrams.generate')}
            </Button>
            {loading ? (
              <Button type="button" variant="secondary" onClick={session.cancel}>
                <FiSquare aria-hidden="true" /> {t('mentor.stop')}
              </Button>
            ) : null}
          </div>
        </form>

        <div aria-live="polite" aria-busy={loading} className="min-w-0">
          {session.status === 'idle' ? <EmptyState title={t('diagrams.emptyTitle')} description={t('diagrams.emptyText')} /> : null}

          {loading ? (
            <Card className="p-6" role="status">
              <p className="text-sm font-semibold text-slate-800">{t('diagrams.generating')}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-1/3 animate-soft-pulse rounded-full bg-learn-gradient" />
              </div>
            </Card>
          ) : null}

          {session.status === 'error' ? (
            <ErrorState
              title={t('diagrams.error.title')}
              description={session.error?.kind === 'invalid' ? t('diagrams.error.invalid') : `${session.error?.message ?? ''} ${t('mentor.error.fallback')}`.trim()}
              actionLabel={t('common.tryAgain')}
              onAction={submit}
            />
          ) : null}

          {session.status === 'success' && session.result ? <DiagramResult key={session.result.requestId} diagram={session.result} /> : null}
        </div>
      </div>
    </motion.section>
  );
}
