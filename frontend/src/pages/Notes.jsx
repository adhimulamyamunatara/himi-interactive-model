import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FiAlertTriangle, FiArrowLeft, FiFileText, FiRefreshCw, FiSave, FiShield, FiX, FiZap } from 'react-icons/fi';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import ConfirmDialog from '../components/common/ConfirmDialog';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Input from '../components/common/Input';
import Skeleton from '../components/common/Skeleton';
import NotesResult from '../components/notes/NotesResult';
import NotesUpload from '../components/notes/NotesUpload';
import SavedNotesList from '../components/notes/SavedNotesList';
import { useToast } from '../context/ToastContext';
import { useNotesWorkflow } from '../hooks/useNotesWorkflow';
import { useSavedNotes } from '../hooks/useSavedNotes';
import { MAX_SAVED_SUMMARIES } from '../utils/notesStorage';
import { MAX_PDF_BYTES, MAX_PDF_PAGES, formatFileSize } from '../utils/notes';

const COPY = {
  idle: { title: 'Summarise your PDF notes', subtitle: 'Upload a text-based PDF and get a short summary, key concepts, definitions, takeaways and revision questions.' },
  extracting: { title: 'Reading your PDF', subtitle: 'Extracting the text. Nothing has been sent to the AI.' },
  extracted: { title: 'Ready to summarise', subtitle: 'Check the details below. Nothing is sent to the AI until you press Summarize.' },
  summarizing: { title: 'Writing your summary', subtitle: 'The AI is reading your notes. This can take up to a minute.' },
  done: { title: 'Your summary', subtitle: 'Save it on this device if you want to come back to it.' },
  error: { title: 'Something went wrong', subtitle: 'Your file was not changed.' },
  viewing: { title: 'Saved summary', subtitle: 'Stored on this device only.' }
};

const stripExtension = (name) => name.replace(/\.pdf$/i, '').trim();

function PrivacyCard() {
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
        <FiShield className="text-blue-600" aria-hidden="true" /> How your PDF is handled
      </h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
        <li>
          Uploading sends the PDF to the HIMI server only to read its text. It is processed in memory, never saved, and
          discarded as soon as the text is returned.
        </li>
        <li>
          The text is <strong>not</strong> sent to the AI until you press <em>Summarize</em>. Then it is sent to Google&apos;s Gemini
          service to write the summary.
        </li>
        <li>The PDF is never stored in your browser. The extracted text stays on this page and disappears when you leave it.</li>
        <li>You can save the finished summary (not the PDF, not the text) on this device. Nothing is synced to other devices.</li>
        <li>Limits: {formatFileSize(MAX_PDF_BYTES)}, {MAX_PDF_PAGES} pages, text-based PDFs only (no OCR for scans).</li>
      </ul>
    </Card>
  );
}

export default function Notes() {
  const toast = useToast();
  const workflow = useNotesWorkflow();
  const saved = useSavedNotes();
  const { state } = workflow;

  const [titleInput, setTitleInput] = useState(null); // null = use the file name
  const [savedRequestId, setSavedRequestId] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null); // record | 'all' | null

  const phase = viewing ? 'viewing' : state.phase;
  const copy = COPY[phase];
  const defaultTitle = state.file ? stripExtension(state.file.name) : '';
  const title = (titleInput ?? defaultTitle).trim();
  const isSaved = state.phase === 'done' && savedRequestId === state.requestId;

  const headingRef = useRef(null);
  const firstRender = useRef(true);

  // Move focus to the heading when the step changes so keyboard and screen-reader users notice.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [phase]);

  const handleFile = (file) => {
    setTitleInput(null);
    setViewing(null);
    workflow.upload(file);
  };

  const handleSave = () => {
    const result = saved.save({
      title: state.result?.title || title,
      fileName: state.file?.name ?? '',
      pageCount: state.extraction?.pageCount ?? 0,
      notes: state.result.notes
    });

    if (result.reason === 'full' && !result.ok) {
      toast.error('Saved list is full', `You can keep up to ${MAX_SAVED_SUMMARIES} summaries. Delete one first.`);
      return;
    }

    setSavedRequestId(state.requestId);

    if (result.ok) {
      toast.success('Summary saved', 'Stored on this device only.');
    } else {
      toast.error('Could not save', 'Your browser refused to store the summary. It will be lost when you leave this page.');
    }
  };

  const handleConfirmDelete = () => {
    const ok = pendingDelete === 'all' ? saved.clearAll() : saved.remove(pendingDelete.id);

    if (!ok) {
      toast.error('Could not update storage', 'Your browser refused the change.');
    } else {
      toast.success(pendingDelete === 'all' ? 'All saved summaries deleted' : 'Summary deleted');
    }

    if (viewing && (pendingDelete === 'all' || pendingDelete.id === viewing.id)) {
      setViewing(null);
    }

    setPendingDelete(null);
  };

  const extraction = state.extraction;

  return (
    <motion.section
      className="section-shell py-10 lg:py-14"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-8">
        <p className="eyebrow">Notes</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-black tracking-tight text-slate-950 outline-none sm:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">{copy.subtitle}</p>
      </div>

      {saved.issue ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          <FiAlertTriangle className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            {saved.issue === 'unavailable'
              ? 'Your browser is blocking local storage, so summaries cannot be saved on this device.'
              : 'Some saved summaries could not be read and were skipped. A copy of the original data was kept on this device.'}
          </p>
          <button type="button" onClick={saved.dismissIssue} className="shrink-0 font-semibold underline">
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {phase === 'idle' ? (
            <>
              <NotesUpload onFile={handleFile} error={workflow.pickError} />
              <Card>
                <h2 className="text-lg font-bold text-slate-950">Saved summaries</h2>
                <div className="mt-4">
                  {saved.records.length === 0 ? (
                    <EmptyState
                      compact
                      icon={FiFileText}
                      title="No saved summaries yet"
                      description="After summarising a PDF you can save the summary here. Only the summary is kept, never the PDF."
                    />
                  ) : (
                    <SavedNotesList
                      records={saved.records}
                      onView={setViewing}
                      onDelete={setPendingDelete}
                      onClearAll={() => setPendingDelete('all')}
                    />
                  )}
                </div>
              </Card>
            </>
          ) : null}

          {phase === 'extracting' || phase === 'summarizing' ? (
            <Card className="p-8 text-center" role="status" aria-live="polite">
              <p className="text-lg font-semibold text-slate-900">
                {phase === 'extracting' ? 'Reading your PDF…' : 'Summarising your notes…'}
              </p>
              <p className="mt-1 break-words text-sm text-slate-600">{state.file?.name}</p>
              <div className="mx-auto mt-6 max-w-md space-y-3" aria-hidden="true">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <Button variant="secondary" className="mt-8" onClick={workflow.cancel}>
                <FiX aria-hidden="true" /> Cancel
              </Button>
            </Card>
          ) : null}

          {phase === 'extracted' && extraction ? (
            <Card className="space-y-5">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-blue-50 p-3 text-xl text-blue-600">
                  <FiFileText aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="break-words font-semibold text-slate-900">{state.file.name}</p>
                  <p className="text-sm text-slate-600">
                    {formatFileSize(state.file.size)} · {extraction.pageCount} page{extraction.pageCount === 1 ? '' : 's'} ·{' '}
                    {extraction.wordCount.toLocaleString()} words
                  </p>
                </div>
              </div>

              {extraction.truncated ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
                  This document is long, so only the first {extraction.characterCount.toLocaleString()} characters will be summarised.
                </p>
              ) : null}

              <details className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">Preview the text that was read</summary>
                <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700" tabIndex={0} aria-label="Extracted text preview">
                  {extraction.text.slice(0, 1500)}
                  {extraction.text.length > 1500 ? '…' : ''}
                </pre>
              </details>

              <Input
                label="Title (optional)"
                value={titleInput ?? defaultTitle}
                maxLength={120}
                onChange={(event) => setTitleInput(event.target.value)}
                hint="Used as the heading of your summary."
              />

              <p className="rounded-2xl bg-blue-50 p-3 text-sm text-blue-900">
                Pressing <strong>Summarize</strong> sends this extracted text to Google&apos;s Gemini service. The PDF file itself is not sent.
              </p>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => workflow.summarize(extraction, title || null)}>
                  <FiZap aria-hidden="true" /> Summarize with AI
                </Button>
                <Button variant="secondary" onClick={workflow.reset}>
                  Choose another file
                </Button>
              </div>
            </Card>
          ) : null}

          {phase === 'done' && state.result ? (
            <Card>
              <NotesResult
                title={state.result.title || title}
                notes={state.result.notes}
                actions={
                  <>
                    <Button size="sm" onClick={handleSave} disabled={isSaved}>
                      <FiSave aria-hidden="true" /> {isSaved ? 'Saved' : 'Save summary'}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={workflow.reset}>
                      <FiRefreshCw aria-hidden="true" /> Start over
                    </Button>
                  </>
                }
              />
              <p className="mt-4 text-xs text-slate-500">
                Not saved yet? Leaving this page discards the summary, the extracted text and the upload.
              </p>
            </Card>
          ) : null}

          {phase === 'viewing' && viewing ? (
            <Card>
              <NotesResult
                title={viewing.title}
                notes={viewing.notes}
                actions={
                  <>
                    <Button variant="secondary" size="sm" onClick={() => setViewing(null)}>
                      <FiArrowLeft aria-hidden="true" /> Back
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPendingDelete(viewing)}>
                      Delete
                    </Button>
                  </>
                }
              />
            </Card>
          ) : null}

          {phase === 'error' && state.error ? (
            <>
              <ErrorState
                title={state.error.stage === 'extract' ? 'This PDF could not be used' : 'Could not write the summary'}
                description={state.error.message}
                actionLabel="Try again"
                onAction={
                  state.error.stage === 'extract' ? workflow.retryUpload : () => workflow.summarize(extraction, title || null)
                }
              />
              <div className="flex justify-center">
                <Button variant="secondary" onClick={workflow.reset}>
                  {state.error.stage === 'extract' ? 'Choose another file' : 'Start over'}
                </Button>
              </div>
            </>
          ) : null}
        </div>

        <aside className="min-w-0">
          <PrivacyCard />
        </aside>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete === 'all' ? 'Delete all saved summaries?' : 'Delete this summary?'}
        description="This removes it from this device. It cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </motion.section>
  );
}
