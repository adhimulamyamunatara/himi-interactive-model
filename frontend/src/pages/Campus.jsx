import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiEdit2, FiInfo, FiPlus, FiSearch, FiSquare, FiTrash2 } from 'react-icons/fi';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ErrorState from '../components/common/ErrorState';
import Input from '../components/common/Input';
import Textarea from '../components/common/Textarea';
import { usePreferences } from '../hooks/usePreferences';
import { useRequestSession } from '../hooks/useRequestSession';
import { useT } from '../i18n/I18nContext';
import { askCampus, describeCampusError } from '../services/campusService';
import {
  buildCampusRequest,
  createDocId,
  loadDocuments,
  MAX_DOC_TEXT,
  MAX_DOC_TITLE,
  MAX_DOCS,
  MAX_QUESTION_CHARS,
  saveDocuments,
  validateDocument
} from '../utils/campus';

function DocumentForm({ initial, onSave, onCancel, saveLabel }) {
  const { t } = useT();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [text, setText] = useState(initial?.text ?? '');
  const [error, setError] = useState(null);

  const submit = (event) => {
    event.preventDefault();
    const checked = validateDocument({ title, text });

    if (!checked.ok) {
      setError(checked.error);
      return;
    }

    setError(null);
    onSave(checked.doc);
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Input
        label={t('campus.docs.docTitle')}
        value={title}
        maxLength={MAX_DOC_TITLE}
        placeholder={t('campus.docs.docTitlePlaceholder')}
        error={error === 'title' ? t('campus.validation.title') : undefined}
        onChange={(event) => setTitle(event.target.value)}
      />
      <Textarea
        label={t('campus.docs.docText')}
        value={text}
        rows={7}
        maxLength={MAX_DOC_TEXT}
        placeholder={t('campus.docs.docTextPlaceholder')}
        error={error === 'text' ? t('campus.validation.text') : error === 'tooLong' ? t('campus.validation.tooLong', { max: MAX_DOC_TEXT }) : undefined}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{saveLabel}</Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export default function Campus() {
  const { t } = useT();
  const { preferences } = usePreferences();
  const session = useRequestSession(askCampus, describeCampusError);

  const [initial] = useState(() => loadDocuments());
  const [docs, setDocs] = useState(initial.docs);
  const [storageIssue, setStorageIssue] = useState(initial.issue);
  const [saveFailed, setSaveFailed] = useState(false);
  // null | 'new' | document id
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [question, setQuestion] = useState('');
  const [questionError, setQuestionError] = useState(false);
  const [asked, setAsked] = useState('');

  const loading = session.status === 'loading';
  const showForm = docs.length === 0 || editing !== null;

  const commit = (next) => {
    setDocs(next);
    setSaveFailed(!saveDocuments(next).ok);

    if (storageIssue === 'repaired' || storageIssue === 'unreadable') {
      setStorageIssue(null);
    }
  };

  const saveDoc = (doc) => {
    if (editing && editing !== 'new') {
      commit(docs.map((item) => (item.id === editing ? { ...item, ...doc, updatedAt: new Date().toISOString() } : item)));
    } else {
      commit([...docs, { id: createDocId(), ...doc, updatedAt: new Date().toISOString() }]);
    }

    setEditing(null);
  };

  const ask = (event) => {
    event?.preventDefault?.();
    const built = buildCampusRequest({ question, docs, language: preferences.explanationLanguage });

    if (!built.ok) {
      setQuestionError(true);
      return;
    }

    setQuestionError(false);
    setAsked(built.request.question);
    session.send(built.request);
  };

  const editingDoc = editing && editing !== 'new' ? docs.find((item) => item.id === editing) : null;
  const result = session.status === 'success' ? session.result : null;

  return (
    <motion.section className="section-shell py-10 lg:py-14" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="mb-8 max-w-3xl">
        <p className="eyebrow">{t('campus.eyebrow')}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{t('campus.title')}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t('campus.subtitle')}</p>
        <p role="note" className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          <FiInfo className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{t('campus.notice')}</span>
        </p>
      </div>

      {storageIssue === 'unavailable' ? (
        <p role="alert" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t('campus.storage.unavailable')}
        </p>
      ) : null}
      {storageIssue === 'unreadable' || storageIssue === 'repaired' ? (
        <p role="status" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t(`campus.storage.${storageIssue}`)}
        </p>
      ) : null}
      {saveFailed ? (
        <p role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {t('campus.saveFailed')}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">{t('campus.docs.title')}</h2>

          {docs.length === 0 ? (
            <div className="mt-3 space-y-2" data-testid="campus-setup">
              <p className="text-sm font-semibold text-slate-800">{t('campus.setup.title')}</p>
              <p className="text-sm leading-6 text-slate-600">{t('campus.setup.text')}</p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {docs.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">{doc.title}</span>
                    <span className="text-xs text-slate-500">{t('campus.docs.chars', { count: doc.text.length })}</span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label={t('campus.docs.editNamed', { title: doc.title })} onClick={() => setEditing(doc.id)}>
                      <FiEdit2 aria-hidden="true" />
                    </button>
                    <button type="button" className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" aria-label={t('campus.docs.deleteNamed', { title: doc.title })} onClick={() => setPendingDelete(doc)}>
                      <FiTrash2 aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5">
            {showForm ? (
              <DocumentForm
                key={editing ?? 'new'}
                initial={editingDoc}
                saveLabel={editingDoc ? t('campus.docs.update') : t('campus.docs.save')}
                onSave={saveDoc}
                onCancel={docs.length > 0 ? () => setEditing(null) : undefined}
              />
            ) : docs.length < MAX_DOCS ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditing('new')}>
                <FiPlus aria-hidden="true" /> {t('campus.docs.add')}
              </Button>
            ) : (
              <p className="text-xs text-slate-500">{t('campus.docs.limit', { max: MAX_DOCS })}</p>
            )}
          </div>
        </Card>

        <div className="min-w-0 space-y-5">
          <Card className="p-5 sm:p-6">
            <form onSubmit={ask} noValidate className="space-y-4">
              <Textarea
                label={t('campus.ask.label')}
                value={question}
                rows={3}
                maxLength={MAX_QUESTION_CHARS}
                placeholder={t('campus.ask.placeholder')}
                error={questionError ? t('campus.validation.question') : undefined}
                onChange={(event) => setQuestion(event.target.value)}
                disabled={loading || docs.length === 0}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={loading || docs.length === 0}>
                  <FiSearch aria-hidden="true" /> {t('campus.ask.button')}
                </Button>
                {loading ? (
                  <Button type="button" variant="secondary" onClick={session.cancel}>
                    <FiSquare aria-hidden="true" /> {t('mentor.stop')}
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>

          <div aria-live="polite" aria-busy={loading}>
            {loading ? (
              <Card className="p-6" role="status">
                <p className="text-sm font-semibold text-slate-800">{t('campus.asking')}</p>
              </Card>
            ) : null}

            {session.status === 'error' ? (
              <ErrorState
                title={t('campus.error.title')}
                description={session.error?.kind === 'invalid' ? t('campus.error.invalid') : `${session.error?.message ?? ''} ${t('mentor.error.fallback')}`.trim()}
                actionLabel={t('common.tryAgain')}
                onAction={ask}
              />
            ) : null}

            {result ? (
              <Card className="p-5 sm:p-6" data-testid="campus-result" data-status={result.status}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{asked}</p>
                <h2 className="mt-2 text-lg font-bold text-slate-900">{result.status === 'answered' ? t('campus.answer.title') : t('campus.answer.notFoundTitle')}</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-800" lang={preferences.explanationLanguage}>
                  {result.answer}
                </p>

                {result.citations.length > 0 ? (
                  <div className="mt-5">
                    <h3 className="text-sm font-bold text-slate-900">{t('campus.answer.sources')}</h3>
                    <ul className="mt-2 space-y-2">
                      {result.citations.map((citation) => (
                        <li key={`${citation.sourceId}-${citation.quote}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                          <span className="font-semibold text-slate-900">{citation.title}</span>
                          <blockquote className="mt-1 border-l-2 border-slate-300 pl-3 text-slate-700">“{citation.quote}”</blockquote>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <p className="mt-4 text-xs leading-5 text-slate-500">{t('campus.answer.verify')}</p>
              </Card>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('campus.docs.deleteTitle')}
        description={t('campus.docs.deleteText', { title: pendingDelete?.title ?? '' })}
        confirmLabel={t('campus.docs.delete')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          commit(docs.filter((item) => item.id !== pendingDelete?.id));
          setPendingDelete(null);
          setEditing(null);
        }}
      />
    </motion.section>
  );
}
