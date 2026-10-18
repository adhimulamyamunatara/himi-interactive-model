import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FiEdit3, FiGitBranch, FiInfo, FiPlus, FiSend, FiSquare } from 'react-icons/fi';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ErrorState from '../components/common/ErrorState';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import Textarea from '../components/common/Textarea';
import { useChat } from '../context/ChatContext';
import { useUser } from '../context/UserContext';
import { usePreferences } from '../hooks/usePreferences';
import { useRequestSession } from '../hooks/useRequestSession';
import { useT } from '../i18n/I18nContext';
import { askTutor, describeTutorError } from '../services/tutorService';
import { describeSummaryError, summariseClassroom } from '../services/campusService';
import {
  addQuestion,
  appendToNotes,
  buildSummaryRequest,
  createRoom,
  hasSessionContent,
  loadRoom,
  MAX_AGENDA_ITEMS,
  MAX_NOTES,
  MAX_QA_CHARS,
  MAX_QUESTIONS,
  MAX_TITLE,
  parseAgendaText,
  saveRoom,
  setNotes,
  setSummary,
  toggleAgenda
} from '../utils/classroom';
import { SUBJECTS } from '../utils/subjects';
import { buildTutorRequest } from '../utils/tutor';

function StorageWarning() {
  const { t } = useT();

  return (
    <p role="alert" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {t('classroom.storageFailed')}
    </p>
  );
}

function Header() {
  const { t } = useT();

  return (
    <div className="mb-8 max-w-3xl">
      <p className="eyebrow">{t('classroom.eyebrow')}</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{t('classroom.title')}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{t('classroom.subtitle')}</p>
      <p role="note" className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
        <FiInfo className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{t('classroom.honesty')}</span>
      </p>
    </div>
  );
}

function SetupForm({ onStart, defaultSubject }) {
  const { t } = useT();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [agenda, setAgenda] = useState('');
  const [error, setError] = useState(false);

  const submit = (event) => {
    event.preventDefault();
    const created = createRoom({ title, subject, agenda: parseAgendaText(agenda) }, { subjects: SUBJECTS });

    if (!created.ok) {
      setError(true);
      return;
    }

    onStart(created.room);
  };

  return (
    <Card className="max-w-2xl p-5 sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">{t('classroom.setup.title')}</h2>
      <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
        <Input
          label={t('classroom.setup.name')}
          value={title}
          maxLength={MAX_TITLE}
          placeholder={t('classroom.setup.namePlaceholder')}
          error={error ? t('classroom.validation.title') : undefined}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Select label={t('common.subject')} value={subject} onChange={(event) => setSubject(event.target.value)}>
          {SUBJECTS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Textarea
          label={t('classroom.setup.agenda')}
          hint={t('classroom.setup.agendaHint', { max: MAX_AGENDA_ITEMS })}
          value={agenda}
          rows={4}
          onChange={(event) => setAgenda(event.target.value)}
        />
        <Button type="submit">
          <FiPlus aria-hidden="true" /> {t('classroom.setup.start')}
        </Button>
      </form>
    </Card>
  );
}

export default function Classroom() {
  const { t } = useT();
  const { user } = useUser();
  const { selectedSubject } = useChat();
  const { preferences } = usePreferences();
  const summarySession = useRequestSession(summariseClassroom, describeSummaryError);

  const [initial] = useState(() => loadRoom());
  const [room, setRoomState] = useState(initial.room);
  const [saveFailed, setSaveFailed] = useState(initial.issue === 'unavailable');
  const [confirmEnd, setConfirmEnd] = useState(false);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState(null);
  const [notice, setNotice] = useState(null);
  const controllerRef = useRef(null);

  // Cancel an in-flight tutor question when the page is left.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const setRoom = (next) => {
    setRoomState(next);
    setSaveFailed(!saveRoom(next).ok);
  };

  const askTutorQuestion = async (event) => {
    event.preventDefault();
    const text = question.trim();

    if (!text || asking || !room || room.questions.length >= MAX_QUESTIONS) {
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setAsking(true);
    setAskError(null);
    setNotice(null);

    try {
      const result = await askTutor(
        buildTutorRequest({
          message: text,
          subject: room.subject,
          topic: room.title.slice(0, 80),
          userName: user?.name ?? '',
          language: preferences.explanationLanguage,
          helpMode: preferences.helpMode,
          history: room.questions.flatMap((entry) => [
            { role: 'user', content: entry.question },
            ...(entry.answer ? [{ role: 'assistant', content: entry.answer }] : [])
          ])
        }),
        { signal: controller.signal }
      );

      if (controller.signal.aborted) {
        return;
      }

      if (result.answer) {
        setRoom(addQuestion(room, { question: text, answer: result.answer }).room);
        setQuestion('');
      } else {
        setNotice(result.handoff ? 'handoff' : 'clarify');
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setAskError(describeTutorError(error));
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }

      if (!controller.signal.aborted) {
        setAsking(false);
      }
    }
  };

  const stopAsking = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setAsking(false);
  };

  const endSession = () => {
    summarySession.reset();
    controllerRef.current?.abort();
    setRoomState(null);
    setSaveFailed(!saveRoom(null).ok);
    setConfirmEnd(false);
    setAsking(false);
    setQuestion('');
  };

  if (!room) {
    return (
      <motion.section className="section-shell py-10 lg:py-14" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Header />
        {saveFailed ? <StorageWarning /> : null}
        <SetupForm defaultSubject={selectedSubject} onStart={(created) => setRoom(created)} />
      </motion.section>
    );
  }

  const summary = summarySession.status === 'success' ? summarySession.result : room.summary;
  const summarising = summarySession.status === 'loading';
  const summarySaved = summarySession.status !== 'success' && room.summary !== null;
  const canSummarise = hasSessionContent(room);

  return (
    <motion.section className="section-shell py-10 lg:py-14" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Header />
      {saveFailed ? <StorageWarning /> : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{room.title}</h2>
          <p className="text-sm text-slate-600">{room.subject}</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmEnd(true)}>
          {t('classroom.end.button')}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-base font-bold text-slate-900">{t('classroom.agenda.title')}</h2>
            {room.agenda.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">{t('classroom.agenda.empty')}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {room.agenda.map((item) => (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-800">
                      <input type="checkbox" className="mt-1 h-4 w-4" checked={item.done} onChange={() => setRoom(toggleAgenda(room, item.id))} />
                      <span className={item.done ? 'text-slate-500 line-through' : ''}>{item.text}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-bold text-slate-900">{t('classroom.tools.title')}</h2>
            <div className="mt-3 flex flex-col gap-2">
              <Link to="/whiteboard" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                <FiEdit3 aria-hidden="true" /> {t('classroom.tools.whiteboard')}
              </Link>
              <Link
                to={`/diagrams?${new URLSearchParams({ subject: room.subject, topic: room.title.slice(0, 120) }).toString()}`}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <FiGitBranch aria-hidden="true" /> {t('classroom.tools.diagram')}
              </Link>
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="p-5 sm:p-6">
            <Textarea
              label={t('classroom.notes.title')}
              hint={t('classroom.notes.hint')}
              value={room.notes}
              rows={6}
              maxLength={MAX_NOTES}
              placeholder={t('classroom.notes.placeholder')}
              onChange={(event) => setRoom(setNotes(room, event.target.value))}
            />
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="text-base font-bold text-slate-900">{t('classroom.qa.title')}</h2>

            {room.questions.length === 0 ? <p className="mt-2 text-sm text-slate-600">{t('classroom.qa.empty')}</p> : null}

            <ol className="mt-3 space-y-4">
              {room.questions.map((entry) => (
                <li key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                  <p className="font-semibold text-slate-900">{entry.question}</p>
                  <p className="mt-2 whitespace-pre-line leading-6 text-slate-700" lang={preferences.explanationLanguage}>
                    {entry.answer}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      const added = appendToNotes(room, `Q: ${entry.question}`);
                      setNotice(added.added ? 'notesAdded' : 'notesFull');

                      if (added.added) {
                        setRoom(added.room);
                      }
                    }}
                  >
                    {t('classroom.qa.addToNotes')}
                  </Button>
                </li>
              ))}
            </ol>

            {room.questions.length < MAX_QUESTIONS ? (
              <form onSubmit={askTutorQuestion} className="mt-4 space-y-3" noValidate>
                <Textarea
                  label={t('classroom.qa.label')}
                  value={question}
                  rows={2}
                  maxLength={MAX_QA_CHARS}
                  placeholder={t('classroom.qa.placeholder')}
                  onChange={(event) => setQuestion(event.target.value)}
                  disabled={asking}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={asking || !question.trim()}>
                    <FiSend aria-hidden="true" /> {asking ? t('classroom.qa.asking') : t('classroom.qa.ask')}
                  </Button>
                  {asking ? (
                    <Button type="button" variant="secondary" onClick={stopAsking}>
                      <FiSquare aria-hidden="true" /> {t('mentor.stop')}
                    </Button>
                  ) : null}
                </div>
              </form>
            ) : (
              <p className="mt-4 text-sm text-slate-600">{t('classroom.qa.limit', { max: MAX_QUESTIONS })}</p>
            )}

            <div aria-live="polite" className="mt-3 text-sm">
              {askError ? (
                <p role="alert" className="text-rose-700">
                  {askError.kind === 'invalid' ? t('classroom.qa.invalid') : askError.message}
                </p>
              ) : null}
              {notice ? <p className="text-slate-700">{t(`classroom.notice.${notice}`)}</p> : null}
            </div>
          </Card>

          <Card className="p-5 sm:p-6" data-testid="classroom-summary-card">
            <h2 className="text-base font-bold text-slate-900">{t('classroom.summary.title')}</h2>
            {!canSummarise ? <p className="mt-2 text-sm text-slate-600">{t('classroom.summary.needsContent')}</p> : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!canSummarise || summarising}
                onClick={() => summarySession.send(buildSummaryRequest(room, preferences.explanationLanguage))}
              >
                {summarising ? t('classroom.summary.generating') : t('classroom.summary.generate')}
              </Button>
              {summarising ? (
                <Button type="button" variant="ghost" onClick={summarySession.cancel}>
                  <FiSquare aria-hidden="true" /> {t('mentor.stop')}
                </Button>
              ) : null}
              {summarySession.status === 'success' ? (
                <Button type="button" onClick={() => setRoom(setSummary(room, summarySession.result))}>
                  {t('classroom.summary.save')}
                </Button>
              ) : null}
            </div>

            <div aria-live="polite">
              {summarySession.status === 'error' ? (
                <div className="mt-4">
                  <ErrorState
                    title={t('classroom.summary.errorTitle')}
                    description={summarySession.error?.kind === 'invalid' ? t('classroom.summary.invalid') : summarySession.error?.message ?? ''}
                    actionLabel={t('common.tryAgain')}
                    onAction={() => summarySession.send(buildSummaryRequest(room, preferences.explanationLanguage))}
                  />
                </div>
              ) : null}

              {summary ? (
                <div className="mt-4 space-y-4 text-sm" lang={preferences.explanationLanguage}>
                  {summarySaved ? <p className="text-xs font-semibold text-emerald-700">{t('classroom.summary.saved')}</p> : null}
                  <p className="whitespace-pre-line leading-6 text-slate-800">{summary.summary}</p>
                  {summary.keyPoints.length > 0 ? (
                    <div>
                      <h3 className="font-bold text-slate-900">{t('classroom.summary.keyPoints')}</h3>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
                        {summary.keyPoints.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {summary.revisionQuestions.length > 0 ? (
                    <div>
                      <h3 className="font-bold text-slate-900">{t('classroom.summary.revision')}</h3>
                      <ol className="mt-1 list-decimal space-y-2 pl-5 text-slate-700">
                        {summary.revisionQuestions.map((item) => (
                          <li key={item.question}>
                            {item.question}
                            {item.hint ? (
                              <span className="block text-xs text-slate-500">
                                {t('classroom.summary.hint')}: {item.hint}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                  <p className="text-xs leading-5 text-slate-500">{t('classroom.summary.disclaimer')}</p>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmEnd}
        title={t('classroom.end.title')}
        description={t('classroom.end.text')}
        confirmLabel={t('classroom.end.confirm')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirmEnd(false)}
        onConfirm={endSession}
      />
    </motion.section>
  );

}
