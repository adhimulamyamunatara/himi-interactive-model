import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FiAlertTriangle, FiEye, FiRotateCcw, FiSave, FiShield, FiTrash2 } from 'react-icons/fi';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import ConfirmDialog from '../components/common/ConfirmDialog';
import SegmentedControl from '../components/common/SegmentedControl';
import Select from '../components/common/Select';
import DifficultTopicsEditor from '../components/memory/DifficultTopicsEditor';
import ListEditor from '../components/memory/ListEditor';
import { useToast } from '../context/ToastContext';
import { useLearningProfile } from '../hooks/useLearningProfile';
import {
  EXPLANATION_LANGUAGES,
  EXPLANATION_LEVELS,
  EXPLANATION_STYLES,
  MAX_GOAL_LENGTH,
  MAX_GOALS,
  MAX_INTEREST_LENGTH,
  MAX_INTERESTS,
  QUIZ_STYLES,
  REVISION_STYLES,
  addListItem,
  buildProfilePayload,
  profilesEqual
} from '../utils/learningProfile';

const ISSUE_MESSAGES = {
  unavailable: 'Your browser is blocking local storage, so learning memory cannot be saved on this device.',
  unreadable: 'Your saved learning memory could not be read, so HIMI started with the defaults. A copy of the unreadable data was kept on this device.',
  repaired: 'Some saved learning memory values were invalid and were replaced with safe defaults. A copy of the original data was kept on this device.'
};

function Section({ title, description, children }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ProfileForm({ saved, onSave, onReset, onDelete }) {
  const [draft, setDraft] = useState(saved);
  const isDirty = !profilesEqual(draft, saved);
  const payload = useMemo(() => JSON.stringify(buildProfilePayload(draft), null, 2), [draft]);
  const setField = (field) => (value) => setDraft((current) => ({ ...current, [field]: value }));
  const selectedLevel = EXPLANATION_LEVELS.find((level) => level.value === draft.explanationLevel);

  return (
    <form
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
      noValidate
    >
      <Section title="How should HIMI explain things?">
        <SegmentedControl
          legend="Explanation level"
          options={EXPLANATION_LEVELS}
          value={draft.explanationLevel}
          onChange={setField('explanationLevel')}
        />
        {selectedLevel ? <p className="text-xs text-slate-500">{selectedLevel.description}</p> : null}
        <div className="grid gap-5 md:grid-cols-2">
          <Select label="Explanation style" value={draft.explanationStyle} onChange={(event) => setField('explanationStyle')(event.target.value)}>
            {EXPLANATION_STYLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select label="Preferred language" value={draft.language} onChange={(event) => setField('language')(event.target.value)}>
            {EXPLANATION_LANGUAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </Section>

      <Section title="Quizzes and revision">
        <div className="grid gap-5 md:grid-cols-2">
          <Select label="Quiz style" value={draft.quizStyle} onChange={(event) => setField('quizStyle')(event.target.value)}>
            {QUIZ_STYLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select label="Revision style" value={draft.revisionStyle} onChange={(event) => setField('revisionStyle')(event.target.value)}>
            {REVISION_STYLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </Section>

      <Section title="Goals and interests" description="Short phrases in your own words. Only what you type here is stored.">
        <ListEditor
          label="Learning goals"
          noun="goal"
          placeholder="e.g. Score 80% in DBMS"
          hint={`Up to ${MAX_GOALS} goals, ${MAX_GOAL_LENGTH} characters each.`}
          items={draft.goals}
          onChange={setField('goals')}
          onAdd={(items, text) => addListItem(items, text, { maxItems: MAX_GOALS, maxLength: MAX_GOAL_LENGTH, noun: 'goal' })}
          maxItems={MAX_GOALS}
          maxLength={MAX_GOAL_LENGTH}
        />
        <ListEditor
          label="Subjects or topics you are interested in"
          noun="interest"
          placeholder="e.g. Databases"
          hint={`Up to ${MAX_INTERESTS} interests, ${MAX_INTEREST_LENGTH} characters each.`}
          items={draft.interests}
          onChange={setField('interests')}
          onAdd={(items, text) =>
            addListItem(items, text, { maxItems: MAX_INTERESTS, maxLength: MAX_INTEREST_LENGTH, noun: 'interest' })
          }
          maxItems={MAX_INTERESTS}
          maxLength={MAX_INTEREST_LENGTH}
        />
      </Section>

      <Section
        title="Topics you find difficult"
        description="HIMI gives these extra care in explanations, quiz explanations and study plans. Only topics you add yourself are used."
      >
        <DifficultTopicsEditor topics={draft.difficultTopics} onChange={setField('difficultTopics')} />
      </Section>

      <details className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
          <FiEye aria-hidden="true" /> See exactly what HIMI sends to the AI
        </summary>
        <p className="mt-3 text-xs text-slate-600">
          This is the data attached to your chat, quiz and study-planner requests while personalisation is on. The AI treats it as
          information about you, not as instructions.
        </p>
        <pre className="mt-3 max-h-64 overflow-auto force-light rounded-xl bg-slate-900 p-3 text-xs text-slate-100" tabIndex={0} aria-label="Learning memory data sent with AI requests">
          {payload}
        </pre>
      </details>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
        <Button type="submit" disabled={!isDirty}>
          <FiSave aria-hidden="true" /> Save learning memory
        </Button>
        <Button variant="secondary" onClick={() => setDraft(saved)} disabled={!isDirty}>
          <FiRotateCcw aria-hidden="true" /> Discard changes
        </Button>
        {isDirty ? <span className="text-sm text-amber-700">You have unsaved changes.</span> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
        <p className="min-w-0 flex-1 text-sm text-slate-700">
          <strong>Start over:</strong> reset to the default preferences, or delete everything this feature stored on this device.
        </p>
        <Button variant="secondary" onClick={onReset}>
          <FiRotateCcw aria-hidden="true" /> Reset to defaults
        </Button>
        <Button variant="danger" onClick={onDelete}>
          <FiTrash2 aria-hidden="true" /> Delete learning memory
        </Button>
      </div>
    </form>
  );
}

export default function LearningMemory() {
  const { state, issue, saveFailed, store } = useLearningProfile();
  const toast = useToast();
  const [confirming, setConfirming] = useState(null); // 'reset' | 'delete' | null
  const [formVersion, setFormVersion] = useState(0);

  const handleSave = (profile) => {
    const { saved } = store.saveProfile(profile);

    if (saved) {
      toast.success('Learning memory saved', 'Stored on this device only.');
    } else {
      toast.error('Could not save', 'Your browser refused to store the data. It will be lost when you leave this page.');
    }
  };

  const handleConfirm = () => {
    if (confirming === 'reset') {
      store.reset();
      toast.success('Reset to defaults', 'Your preferences are back to the defaults.');
    } else {
      store.deleteAll();
      toast.success('Learning memory deleted', 'Nothing about your learning preferences is stored any more.');
    }

    setConfirming(null);
    setFormVersion((version) => version + 1);
  };

  return (
    <motion.section
      className="section-shell py-10 lg:py-14"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-8">
        <p className="eyebrow">Learning memory</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Personalise HIMI</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Tell HIMI how you like to learn. You can view, edit, switch off, reset or delete this at any time.
        </p>
      </div>

      {issue ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          <FiAlertTriangle className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1">{ISSUE_MESSAGES[issue]}</p>
          <button type="button" onClick={() => store.dismissIssue()} className="shrink-0 font-semibold underline">
            Dismiss
          </button>
        </div>
      ) : null}

      {saveFailed ? (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
          The last change could not be written to this browser&apos;s storage, so it may be lost when you close the page.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="personalization-label" className="text-base font-bold text-slate-950">
                  Personalisation
                </h2>
                <p id="personalization-description" className="mt-1 text-sm text-slate-600">
                  {state.enabled
                    ? state.touched
                      ? 'On. Your saved preferences are used in chat, quizzes and study plans.'
                      : 'On, but nothing is shared until you save your preferences.'
                    : 'Off. HIMI answers normally and sends none of your preferences.'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={state.enabled}
                aria-labelledby="personalization-label"
                aria-describedby="personalization-description"
                onClick={() => store.setEnabled(!state.enabled)}
                className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${
                  state.enabled ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    state.enabled ? 'translate-x-5' : ''
                  }`}
                />
                <span className="sr-only">{state.enabled ? 'Turn personalisation off' : 'Turn personalisation on'}</span>
              </button>
            </div>
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
              <FiShield className="text-blue-600" aria-hidden="true" /> Your data
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Saved in this browser only. It is not synced to other devices and there is no account backup.</li>
              <li>Only what you enter here is used. HIMI does not guess things about you.</li>
              <li>While personalisation is on, these preferences are sent to the AI service together with each chat, quiz or study-plan request.</li>
              <li>The backend does not store them.</li>
            </ul>
          </Card>
        </div>

        <Card>
          <ProfileForm
            key={`${formVersion}-${state.updatedAt ?? 'none'}`}
            saved={state.profile}
            onSave={handleSave}
            onReset={() => setConfirming('reset')}
            onDelete={() => setConfirming('delete')}
          />
        </Card>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title={confirming === 'delete' ? 'Delete learning memory?' : 'Reset to default preferences?'}
        description={
          confirming === 'delete'
            ? 'This removes your saved preferences, goals, interests and difficult topics from this device. It cannot be undone.'
            : 'Your explanation, quiz and revision preferences, goals, interests and difficult topics go back to the defaults. It cannot be undone.'
        }
        confirmLabel={confirming === 'delete' ? 'Delete' : 'Reset'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(null)}
      />
    </motion.section>
  );
}
