import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FiCamera, FiImage, FiInfo, FiSquare, FiTrash2, FiVideoOff } from 'react-icons/fi';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import SegmentedControl from '../components/common/SegmentedControl';
import Select from '../components/common/Select';
import CameraResult from '../components/camera/CameraResult';
import CapabilityList from '../components/camera/CapabilityList';
import CheckIn from '../components/camera/CheckIn';
import { useCameraStream } from '../hooks/useCameraStream';
import { usePreferences } from '../hooks/usePreferences';
import { useRequestSession } from '../hooks/useRequestSession';
import { useT } from '../i18n/I18nContext';
import { analyzePhoto, describeCameraError } from '../services/cameraService';
import {
  ALLOWED_IMAGE_TYPES,
  buildCameraRequest,
  CAMERA_TASKS,
  describeCapabilities,
  getCameraSupport,
  isFaceDetectorSupported,
  MAX_QUESTION_CHARS,
  validateCameraInput,
  validateImageFile
} from '../utils/camera';
import { photoFromFile, photoFromVideo } from '../utils/cameraImage';
import { LANGUAGES } from '../utils/preferences';
import { countFaces } from '../utils/faceCheck';
import { SUBJECTS } from '../utils/subjects';

const VALIDATION_KEYS = {
  empty: 'camera.validation.empty',
  question_required: 'camera.validation.question',
  question_too_long: 'camera.validation.questionLong',
  too_large: 'camera.validation.tooLarge'
};

export default function Camera() {
  const { t } = useT();
  const { preferences, update } = usePreferences();
  const session = useRequestSession(analyzePhoto, describeCameraError);
  const camera = useCameraStream({ allowed: preferences.cameraEnabled });
  const [support] = useState(() => getCameraSupport());
  const [faceSupported] = useState(() => isFaceDetectorSupported());

  // The one photo on screen. It lives only in this component's memory (never in storage) and is gone on Discard or when leaving.
  const [photo, setPhoto] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [fileError, setFileError] = useState(null);
  // The stream whose first frame has arrived. Take photo stays off until then, so it can never capture a blank frame.
  const [readyStream, setReadyStream] = useState(null);
  const [task, setTask] = useState('explain');
  const [question, setQuestion] = useState('');
  const [subject, setSubject] = useState('');
  const [touched, setTouched] = useState(false);
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const questionRef = useRef(null);
  const resultRef = useRef(null);
  const photoCounter = useRef(0);

  const loading = session.status === 'loading';
  const cameraOn = camera.status === 'live';
  const cameraBusy = camera.status === 'starting';
  const previewReady = camera.stream !== null && readyStream === camera.stream;
  const capabilities = useMemo(() => describeCapabilities({ cameraSupported: support.supported, faceDetectorSupported: faceSupported }), [support.supported, faceSupported]);
  const validation = validateCameraInput({ task, question, imageBase64: photo?.base64 ?? '' });
  const validationKey = touched && validation ? VALIDATION_KEYS[validation] : null;

  // Show the live preview while a stream is open and release it from the element when it closes.
  useEffect(() => {
    const video = videoRef.current;

    if (!video || !camera.stream) {
      return undefined;
    }

    video.srcObject = camera.stream;
    return () => {
      video.srcObject = null;
    };
  }, [camera.stream]);

  const setNewPhoto = (prepared, source) => {
    const id = (photoCounter.current += 1);
    setPhoto({ id, source, dataUrl: prepared.dataUrl, base64: prepared.base64, mimeType: prepared.mimeType, face: faceSupported ? { status: 'checking', faces: 0 } : null });
    session.reset();
    setTouched(false);

    if (faceSupported) {
      // Runs on this device, on this still only, and yields a count. Late results for a discarded photo are ignored.
      countFaces(prepared.canvas).then((face) => setPhoto((current) => (current?.id === id ? { ...current, face } : current)));
    }
  };

  const takePhoto = () => {
    setFileError(null);
    const prepared = photoFromVideo(videoRef.current);

    if (!prepared) {
      setFileError('camera.validation.notReady');
      return;
    }

    setNewPhoto(prepared, 'camera');
    // One still is all that is needed, so the camera goes off straight away.
    camera.stop();
  };

  const chooseFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const problem = validateImageFile(file);

    if (problem) {
      setFileError(problem === 'type' ? 'camera.validation.type' : problem === 'size' ? 'camera.validation.size' : 'camera.validation.unreadable');
      return;
    }

    setFileError(null);
    setPreparing(true);
    const prepared = await photoFromFile(file);
    setPreparing(false);

    if (!prepared) {
      setFileError('camera.validation.unreadable');
      return;
    }

    setNewPhoto(prepared, 'file');
  };

  const discard = () => {
    photoCounter.current += 1;
    session.reset();
    setPhoto(null);
    setFileError(null);
    setTouched(false);
  };

  const turnOnCamera = () => {
    setFileError(null);
    camera.start();
  };

  const run = async (event) => {
    event?.preventDefault?.();
    setTouched(true);

    if (validation || loading || !photo) {
      return;
    }

    const outcome = await session.send(
      buildCameraRequest({
        imageBase64: photo.base64,
        mimeType: photo.mimeType,
        task,
        question,
        subject,
        language: preferences.explanationLanguage,
        helpMode: preferences.helpMode
      })
    );

    if (outcome.started && !outcome.reason) {
      resultRef.current?.focus();
    }
  };

  const applyFollowUp = (text) => {
    setTask('question');
    setQuestion(text.slice(0, MAX_QUESTION_CHARS));
    questionRef.current?.focus();
  };

  const cameraMessage = !support.supported ? t(support.reason === 'insecure' ? 'camera.insecure' : 'camera.unsupported') : null;

  return (
    <motion.section className="section-shell py-10 lg:py-14" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="mb-8 max-w-3xl">
        <p className="eyebrow">{t('camera.eyebrow')}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{t('camera.title')}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t('camera.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] lg:items-start">
        <form onSubmit={run} className="section-card min-w-0 space-y-5 p-5 sm:p-6" noValidate>
          <fieldset className="min-w-0 space-y-3" disabled={loading}>
            <legend className="text-sm font-medium text-slate-700">{t('camera.source')}</legend>

            {!preferences.cameraEnabled ? (
              <div role="note" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">{t('camera.disabled.title')}</p>
                <p className="mt-1 leading-6">{t('camera.disabled.text')}</p>
                <Link to="/profile" className="mt-2 inline-block font-semibold underline">
                  {t('camera.disabled.link')}
                </Link>
              </div>
            ) : cameraMessage ? (
              <p role="note" className="flex items-start gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                <FiVideoOff className="mt-0.5 shrink-0" aria-hidden="true" /> {cameraMessage}
              </p>
            ) : (
              <>
                <p className="flex items-start gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
                  <FiInfo className="mt-0.5 shrink-0" aria-hidden="true" /> {t('camera.consent')}
                </p>

                {cameraOn ? (
                  <div className="space-y-3">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      onLoadedData={() => setReadyStream(camera.stream)}
                      aria-label={t('camera.preview')}
                      data-testid="camera-preview"
                      className="aspect-[4/3] w-full rounded-2xl bg-slate-900 object-cover"
                    />
                    <p className="text-xs text-slate-600">{t('camera.liveHelp')}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={takePhoto} disabled={!previewReady}>
                        <FiCamera aria-hidden="true" /> {t('camera.takePhoto')}
                      </Button>
                      <Button type="button" variant="secondary" onClick={camera.stop}>
                        <FiVideoOff aria-hidden="true" /> {t('camera.turnOff')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={turnOnCamera} disabled={cameraBusy}>
                      <FiCamera aria-hidden="true" /> {t('camera.useCamera')}
                    </Button>
                  </div>
                )}
              </>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} id="camera-file" type="file" accept={ALLOWED_IMAGE_TYPES.join(',')} className="sr-only" onChange={chooseFile} tabIndex={-1} aria-hidden="true" />
              <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
                <FiImage aria-hidden="true" /> {t('camera.chooseFile')}
              </Button>
              <span className="text-xs text-slate-600">{t('camera.fileHint')}</span>
            </div>

            <div role="status" aria-live="polite" className="min-h-5 text-sm text-slate-700">
              {cameraBusy
                ? t('camera.starting')
                : preparing
                  ? t('camera.processing')
                  : cameraOn
                    ? t('camera.live')
                    : camera.leftTab
                      ? t('camera.tabHidden')
                      : ''}
            </div>
            {camera.errorKey ? (
              <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {t(camera.errorKey)}
              </p>
            ) : null}
            {fileError ? (
              <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {t(fileError)}
              </p>
            ) : null}
          </fieldset>

          {photo ? (
            <div className="space-y-3">
              <figure className="min-w-0">
                <img src={photo.dataUrl} alt={t('camera.photo')} className="max-h-80 w-full rounded-2xl border border-slate-200 bg-slate-50 object-contain" />
                <figcaption className="mt-2 text-xs leading-5 text-slate-600">{t('camera.photoNote')}</figcaption>
              </figure>

              {photo.face?.status === 'done' ? (
                <p role="status" className={`rounded-2xl px-4 py-3 text-sm ${photo.face.faces > 0 ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>
                  {photo.face.faces > 0 ? t('camera.faceFound') : t('camera.faceNone')}
                </p>
              ) : photo.face?.status === 'failed' ? (
                <p role="status" className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                  {t('camera.faceFailed')}
                </p>
              ) : null}

              <Button type="button" variant="ghost" onClick={discard} disabled={loading}>
                <FiTrash2 aria-hidden="true" /> {t('camera.discard')}
              </Button>
            </div>
          ) : null}

          <SegmentedControl
            legend={t('camera.task')}
            options={CAMERA_TASKS.map((item) => ({ value: item, label: t(`camera.task.${item}`) }))}
            value={task}
            onChange={setTask}
            disabled={loading}
          />

          <SegmentedControl
            legend={t('language.explanation')}
            options={LANGUAGES.map((language) => ({ value: language.code, label: language.nativeLabel }))}
            value={preferences.explanationLanguage}
            onChange={(value) => update({ explanationLanguage: value })}
            disabled={loading}
          />

          <div className="flex flex-col gap-2">
            <label htmlFor="camera-question" className="text-sm font-medium text-slate-700">
              {t('camera.question')}
              {task === 'question' ? null : <span className="font-normal text-slate-500"> ({t('common.optional')})</span>}
            </label>
            <textarea
              id="camera-question"
              ref={questionRef}
              rows={2}
              value={question}
              maxLength={MAX_QUESTION_CHARS}
              placeholder={t('camera.questionPlaceholder')}
              onChange={(event) => setQuestion(event.target.value)}
              disabled={loading}
              className="w-full resize-y rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
            />
          </div>

          <Select label={t('camera.subject')} value={subject} onChange={(event) => setSubject(event.target.value)} disabled={loading}>
            <option value="">{t('camera.subjectAny')}</option>
            {SUBJECTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>

          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900" role="note">
            {t('camera.disclosure')}
          </p>

          <div id="camera-validation" role="alert" className="min-h-5 text-sm font-medium text-rose-600">
            {validationKey ? t(validationKey) : ''}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={loading || preparing}>
              <FiCamera aria-hidden="true" /> {t('camera.send')}
            </Button>
            {loading ? (
              <Button type="button" variant="secondary" onClick={session.cancel}>
                <FiSquare aria-hidden="true" /> {t('camera.stop')}
              </Button>
            ) : null}
          </div>
        </form>

        <div aria-live="polite" aria-busy={loading} className="min-w-0">
          {session.status === 'idle' ? <EmptyState title={t('camera.emptyTitle')} description={t('camera.emptyText')} /> : null}

          {loading ? (
            <Card className="p-6" role="status">
              <p className="text-sm font-semibold text-slate-800">{t('camera.sending')}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-1/3 animate-soft-pulse rounded-full bg-learn-gradient" />
              </div>
            </Card>
          ) : null}

          {session.status === 'error' ? (
            <ErrorState
              title={t('camera.apiError.title')}
              description={session.error?.kind === 'invalid' ? t('camera.apiError.invalid') : session.error?.message ?? ''}
              actionLabel={t('common.tryAgain')}
              onAction={photo ? run : undefined}
            />
          ) : null}

          {session.status === 'success' && session.result ? (
            <div ref={resultRef} tabIndex={-1} className="outline-none">
              <CameraResult result={session.result} onFollowUp={applyFollowUp} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start">
        <CapabilityList capabilities={capabilities} />
        <CheckIn />
      </div>
    </motion.section>
  );
}
