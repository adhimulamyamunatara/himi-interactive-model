import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { FiMic, FiRefreshCw, FiSend, FiSquare } from 'react-icons/fi';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Input from '../components/common/Input';
import SegmentedControl from '../components/common/SegmentedControl';
import Select from '../components/common/Select';
import MentorResult from '../components/mentor/MentorResult';
import VoicePanel from '../components/voice/VoicePanel';
import { useChat } from '../context/ChatContext';
import { useUser } from '../context/UserContext';
import { useAutoRead } from '../hooks/useAutoRead';
import { usePreferences } from '../hooks/usePreferences';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { useStopSpeechOnLeave } from '../hooks/useSpeechOutput';
import { useTutorSession } from '../hooks/useTutorSession';
import { useT } from '../i18n/I18nContext';
import { loadQuizAttempts } from '../utils/analyticsStorage';
import { LANGUAGES } from '../utils/preferences';
import { appendTranscript } from '../utils/speechText';
import { SUBJECTS } from '../utils/subjects';
import { buildProgressSummary, buildTutorRequest, MAX_MESSAGE_CHARS, MAX_TOPIC_CHARS } from '../utils/tutor';
import { voiceInputLanguageFor } from '../utils/voice';

const HELP_OPTIONS = ['hint', 'guided', 'full'];

export default function Mentor() {
  const { t } = useT();
  const { user } = useUser();
  const { selectedSubject } = useChat();
  const { preferences, update } = usePreferences();
  const session = useTutorSession();
  const [searchParams] = useSearchParams();

  const linkedSubject = searchParams.get('subject');
  const [subject, setSubject] = useState(SUBJECTS.includes(linkedSubject) ? linkedSubject : selectedSubject);
  const [topic, setTopic] = useState((searchParams.get('topic') ?? '').slice(0, MAX_TOPIC_CHARS));
  const [message, setMessage] = useState('');
  const questionRef = useRef(null);
  const resultRef = useRef(null);

  // Read once on mount; recomputed per subject below. Quiz results never leave the browser except as the summary figures.
  const [attempts] = useState(() => loadQuizAttempts().attempts);
  const progress = useMemo(() => buildProgressSummary(attempts, subject), [attempts, subject]);

  const loading = session.status === 'loading';
  const trimmed = message.trim();

  // Voice: dictation only fills the question box (the student still presses Ask), replies are read on request,
  // or automatically when the student turned that on in their profile.
  const [voiceOpen, setVoiceOpen] = useState(false);
  const addTranscript = useCallback((text) => setMessage((current) => appendTranscript(current, text, MAX_MESSAGE_CHARS).value), []);
  const voice = useSpeechInput({ resetKey: 'mentor', onTranscript: addTranscript });
  const showVoice = preferences.voiceEnabled && voiceOpen;
  useStopSpeechOnLeave('mentor');

  const readableReplies = useMemo(
    () => (session.status === 'success' && session.result ? [{ id: `mentor-${session.result.requestId}`, text: session.result.answer }] : []),
    [session.status, session.result]
  );
  useAutoRead({ ownerKey: 'mentor', replies: readableReplies, voiceEnabled: preferences.voiceEnabled, autoReadReplies: preferences.autoReadReplies });

  const toggleVoice = () => {
    if (voiceOpen) {
      voice.cancel();
    } else {
      voice.setLanguage(voiceInputLanguageFor(preferences.explanationLanguage));
    }

    setVoiceOpen(!voiceOpen);
  };

  useEffect(() => {
    if (session.status === 'success') {
      resultRef.current?.focus({ preventScroll: false });
    }
  }, [session.status]);

  const submit = async (event) => {
    event.preventDefault();

    if (!trimmed || loading) {
      return;
    }

    voice.cancel();
    const outcome = await session.send(
      (history) =>
        buildTutorRequest({
          message: trimmed,
          subject,
          topic,
          userName: user?.name ?? '',
          language: preferences.explanationLanguage,
          helpMode: preferences.helpMode,
          history,
          progress
        }),
      trimmed
    );

    if (outcome.started && !outcome.reason) {
      setMessage('');
    }
  };

  const applyFollowUp = (question) => {
    setMessage(question);
    questionRef.current?.focus();
  };

  const startOver = () => {
    session.reset();
    setMessage('');
    questionRef.current?.focus();
  };

  return (
    <motion.section className="section-shell py-10 lg:py-14" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="mb-8 max-w-3xl">
        <p className="eyebrow">{t('mentor.eyebrow')}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{t('mentor.title')}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t('mentor.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <form onSubmit={submit} className="section-card space-y-5 p-5 sm:p-6 lg:sticky lg:top-24" noValidate>
          <Select label={t('mentor.subject')} value={subject} onChange={(event) => setSubject(event.target.value)} disabled={loading}>
            {SUBJECTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>

          <Input
            label={t('mentor.topic')}
            value={topic}
            maxLength={MAX_TOPIC_CHARS}
            placeholder={t('mentor.topicPlaceholder')}
            onChange={(event) => setTopic(event.target.value)}
            disabled={loading}
          />

          <SegmentedControl
            legend={t('language.explanation')}
            options={LANGUAGES.map((language) => ({ value: language.code, label: language.nativeLabel }))}
            value={preferences.explanationLanguage}
            onChange={(value) => update({ explanationLanguage: value })}
            disabled={loading}
          />
          <p className="-mt-3 text-xs leading-5 text-slate-500">{t('language.explanationHint')}</p>

          <SegmentedControl
            legend={t('mentor.helpMode')}
            options={HELP_OPTIONS.map((mode) => ({ value: mode, label: t(`mentor.help.${mode}`) }))}
            value={preferences.helpMode}
            onChange={(value) => update({ helpMode: value })}
            disabled={loading}
          />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="mentor-question" className="text-sm font-medium text-slate-700">
                {t('mentor.question')}
              </label>
              {preferences.voiceEnabled ? (
                <button
                  type="button"
                  onClick={toggleVoice}
                  disabled={loading}
                  aria-pressed={showVoice}
                  aria-label={t('voice.input')}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:opacity-60 ${
                    voice.status === 'listening'
                      ? 'animate-pulse border-rose-300 bg-rose-50 text-rose-600'
                      : showVoice
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-slate-50 hover:text-blue-600'
                  }`}
                >
                  <FiMic aria-hidden="true" />
                </button>
              ) : null}
            </div>
            {showVoice ? (
              <VoicePanel
                voice={voice}
                onClose={() => {
                  voice.cancel();
                  setVoiceOpen(false);
                }}
                submitLabel={t('mentor.ask')}
              />
            ) : null}
            <textarea
              id="mentor-question"
              ref={questionRef}
              rows={4}
              value={message}
              maxLength={MAX_MESSAGE_CHARS}
              placeholder={t('mentor.questionPlaceholder')}
              onChange={(event) => setMessage(event.target.value)}
              disabled={loading}
              className="w-full resize-y rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
            />
          </div>

          <p className="text-xs leading-5 text-slate-500">
            {progress
              ? t('mentor.progress.recorded', { attempts: progress.attempts, average: progress.averagePercent, subject })
              : t('mentor.progress.none', { subject })}
          </p>

          <div className="flex flex-wrap gap-2">
            {/* Ask stays where it is (disabled) while loading, so a quick second click can never hit Stop. */}
            <Button type="submit" disabled={!trimmed || loading}>
              <FiSend aria-hidden="true" /> {t('mentor.ask')}
            </Button>
            {loading ? (
              <Button type="button" variant="secondary" onClick={session.cancel}>
                <FiSquare aria-hidden="true" /> {t('mentor.stop')}
              </Button>
            ) : null}
            {session.status !== 'idle' && !loading ? (
              <Button type="button" variant="ghost" onClick={startOver}>
                <FiRefreshCw aria-hidden="true" /> {t('mentor.newQuestion')}
              </Button>
            ) : null}
          </div>

          <p className="text-xs leading-5 text-slate-500">{t('mentor.memoryNote')}</p>
        </form>

        <div aria-live="polite" aria-busy={loading} className="min-w-0">
          {session.status === 'idle' ? (
            <EmptyState title={t('mentor.emptyTitle')} description={t('mentor.emptyText')} />
          ) : null}

          {loading ? (
            <Card className="p-6" role="status">
              <p className="text-sm font-semibold text-slate-800">{t('mentor.asking')}</p>
              {session.lastRequest ? <p className="mt-2 text-sm text-slate-600">“{session.lastRequest.message}”</p> : null}
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-1/3 animate-soft-pulse rounded-full bg-learn-gradient" />
              </div>
            </Card>
          ) : null}

          {session.status === 'error' ? (
            <ErrorState
              title={t('mentor.error.title')}
              description={
                session.error?.kind === 'invalid'
                  ? t('mentor.error.invalid')
                  : `${session.error?.message ?? ''} ${t('mentor.error.fallback')}`.trim()
              }
              actionLabel={t('common.tryAgain')}
              onAction={trimmed ? submit : undefined}
            />
          ) : null}

          {session.status === 'success' && session.result ? (
            <div ref={resultRef} tabIndex={-1} className="space-y-3 outline-none">
              {session.lastRequest ? (
                <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                  <span className="sr-only">{t('mentor.question')}: </span>“{session.lastRequest.message}”
                </p>
              ) : null}
              <MentorResult
                result={session.result}
                subject={subject}
                topic={topic}
                voiceEnabled={preferences.voiceEnabled}
                onFollowUp={applyFollowUp}
              />
            </div>
          ) : null}

          {session.status === 'error' ? (
            <p className="mt-4 text-sm text-slate-600">
              <Link to="/chat" className="font-semibold text-blue-700 underline">
                {t('mentor.error.openChat')}
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}
