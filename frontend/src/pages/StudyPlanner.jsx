import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import ConfirmDialog from '../components/common/ConfirmDialog';
import PlanConfigForm from '../components/planner/PlanConfigForm';
import PlanGenerating from '../components/planner/PlanGenerating';
import PlanList from '../components/planner/PlanList';
import PlanView from '../components/planner/PlanView';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import { useStudyPlanGeneration } from '../hooks/useStudyPlanGeneration';
import { useStudyPlans } from '../hooks/useStudyPlans';
import { useToday } from '../hooks/useToday';
import { MAX_SAVED_PLANS, findPlanRecord } from '../utils/studyPlanStorage';
import { calculateProgress, createDefaultConfig } from '../utils/studyPlanner';

const VIEW_COPY = {
  list: { eyebrow: 'Study planner', title: 'Plan your exam preparation', subtitle: 'Turn your subjects, exam date and free time into a day-by-day plan.' },
  form: { eyebrow: 'New study plan', title: 'Tell HIMI about your exam', subtitle: 'A few details are enough. You can change everything later.' },
  generating: { eyebrow: 'Study planner', title: 'Getting your plan ready', subtitle: 'Hang tight while HIMI builds your schedule.' },
  plan: { eyebrow: 'Study plan', title: 'Your study plan', subtitle: 'Tick tasks off as you go. Your progress is saved in this browser.' }
};

export default function StudyPlanner() {
  const toast = useToast();
  const { user } = useUser();
  const today = useToday();
  const { plans, loadIssue, dismissLoadIssue, canAddMore, addPlan, replacePlan, toggleTask, deletePlan } = useStudyPlans();
  const generation = useStudyPlanGeneration();

  const [searchParams, setSearchParams] = useSearchParams();
  const activeId = searchParams.get('plan');
  const activeRecord = activeId ? findPlanRecord(plans, activeId) : null;

  // null | { mode: 'new' } | { mode: 'regenerate', id }
  const [formTarget, setFormTarget] = useState(null);
  const [draft, setDraft] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const view = generation.status === 'generating' ? 'generating' : formTarget ? 'form' : activeRecord ? 'plan' : 'list';
  const copy = VIEW_COPY[view];

  const headingRef = useRef(null);
  const isFirstRender = useRef(true);

  // Move focus to the heading when the view changes so keyboard and screen-reader users notice.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view]);

  const showPlan = (id) => setSearchParams(id ? { plan: id } : {});

  const notifySaveFailure = (saved) => {
    if (!saved) {
      toast.error('Could not save to this browser', 'Your plan is visible now but may be lost when you close the tab. Check that browser storage is allowed.');
    }
  };

  /* ---------------------------------------------------------------- form */

  const openNewForm = () => {
    if (!canAddMore) {
      toast.info('Plan limit reached', `You can keep up to ${MAX_SAVED_PLANS} plans. Delete one to create another.`);
      return;
    }

    generation.clearError();
    setDraft(createDefaultConfig());
    setFormTarget({ mode: 'new' });
  };

  const openRegenerateForm = () => {
    generation.clearError();
    setDraft(activeRecord.config);
    setFormTarget({ mode: 'regenerate', id: activeRecord.id });
  };

  const closeForm = () => {
    generation.clearError();
    setFormTarget(null);
  };

  const runGeneration = async (config) => {
    const target = formTarget;
    const plan = await generation.generate(config);

    if (!plan || !target) {
      return; // failed, cancelled or ignored: the form (with its values) is shown again
    }

    if (target.mode === 'regenerate') {
      const { saved } = replacePlan(target.id, plan, config);
      setFormTarget(null);
      showPlan(target.id);
      toast.success('Plan regenerated', 'Your new schedule replaced the old one.');
      notifySaveFailure(saved);
      return;
    }

    const { record, saved } = addPlan(plan, config);

    if (!record) {
      toast.error('Plan limit reached', `Delete a saved plan to keep a new one (limit ${MAX_SAVED_PLANS}).`);
      return;
    }

    setFormTarget(null);
    showPlan(record.id);
    toast.success('Study plan ready', 'It is saved in this browser. Tick tasks off as you finish them.');
    notifySaveFailure(saved);
  };

  const handleSubmit = (config) => {
    const existing = formTarget?.mode === 'regenerate' ? findPlanRecord(plans, formTarget.id) : null;

    if (existing && calculateProgress(existing.plan).completedTasks > 0) {
      setConfirmReplace(true);
      return;
    }

    runGeneration(config);
  };

  /* ---------------------------------------------------------------- plans */

  const handleToggleTask = (taskId, completed) => {
    notifySaveFailure(toggleTask(activeRecord.id, taskId, completed).saved);
  };

  const pendingDelete = pendingDeleteId ? findPlanRecord(plans, pendingDeleteId) : null;

  const confirmDelete = () => {
    const record = pendingDelete;
    setPendingDeleteId(null);

    if (!record) {
      return;
    }

    const { saved } = deletePlan(record.id);

    if (activeId === record.id) {
      showPlan(null);
    }

    toast.success('Plan deleted', `"${record.title}" was removed from this browser.`);
    notifySaveFailure(saved);
  };

  const replaceTarget = confirmReplace && formTarget?.mode === 'regenerate' ? findPlanRecord(plans, formTarget.id) : null;
  const completedInTarget = replaceTarget ? calculateProgress(replaceTarget.plan).completedTasks : 0;
  const profileParts = [user?.branch, user?.semester ? `Semester ${user.semester}` : ''].filter(Boolean);

  return (
    <motion.section
      className="section-shell py-10 lg:py-14"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-8">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-black tracking-tight text-slate-950 outline-none sm:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{copy.subtitle}</p>
      </div>

      {view === 'list' ? (
        <PlanList
          records={plans}
          today={today}
          loadIssue={loadIssue}
          onDismissIssue={dismissLoadIssue}
          missingPlan={Boolean(activeId) && !activeRecord}
          canAddMore={canAddMore}
          onCreate={openNewForm}
          onOpen={showPlan}
          onDelete={setPendingDeleteId}
        />
      ) : null}

      {view === 'form' ? (
        <PlanConfigForm
          config={draft}
          onChange={setDraft}
          today={today}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          submitLabel={formTarget.mode === 'regenerate' ? 'Regenerate plan' : 'Generate plan'}
          error={generation.error}
          onRetry={generation.error ? () => handleSubmit(draft) : undefined}
          profileHint={profileParts.length > 0 ? `Planning for ${profileParts.join(' · ')}` : 'Tell HIMI when your exam is and how much time you have.'}
        />
      ) : null}

      {view === 'generating' ? <PlanGenerating config={draft} today={today} onCancel={generation.cancel} /> : null}

      {view === 'plan' ? (
        <PlanView
          key={`${activeRecord.id}:${activeRecord.plan.id}`}
          record={activeRecord}
          today={today}
          onBack={() => showPlan(null)}
          onToggleTask={handleToggleTask}
          onRegenerate={openRegenerateForm}
          onDelete={() => setPendingDeleteId(activeRecord.id)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this study plan?"
        description={
          pendingDelete
            ? `"${pendingDelete.title}" and its progress (${calculateProgress(pendingDelete.plan).completedTasks} of ${calculateProgress(pendingDelete.plan).totalTasks} tasks done) will be removed from this browser. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete plan"
        cancelLabel="Keep plan"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />

      <ConfirmDialog
        open={Boolean(replaceTarget)}
        tone="warning"
        title="Replace your current plan?"
        description={`Regenerating replaces the current schedule with a new one, and your ${completedInTarget} completed ${completedInTarget === 1 ? 'task' : 'tasks'} will be reset. If generation fails, your current plan stays exactly as it is.`}
        confirmLabel="Replace plan"
        cancelLabel="Keep current plan"
        onConfirm={() => {
          setConfirmReplace(false);
          runGeneration(draft);
        }}
        onCancel={() => setConfirmReplace(false)}
      />
    </motion.section>
  );
}
