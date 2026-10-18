import { useCallback, useRef, useState } from 'react';
import {
  addPlanRecord,
  canAddPlan,
  createPlanRecord,
  loadStudyPlans,
  removePlanRecord,
  replacePlanContent,
  saveStudyPlans,
  updatePlanInRecords
} from '../utils/studyPlanStorage';
import { setTaskCompleted } from '../utils/studyPlanner';

/**
 * Saved study plans, persisted to localStorage on every change (this browser only).
 *
 * The latest list is also kept in a ref so rapid consecutive actions (for example two quick
 * checkbox clicks) always build on the newest data. Each action returns whether the browser
 * accepted the write, so the page can tell the student when saving failed.
 */
export function useStudyPlans() {
  const [initial] = useState(() => loadStudyPlans());
  const [plans, setPlans] = useState(initial.plans);
  const [loadIssue, setLoadIssue] = useState(initial.issue === null ? null : { type: initial.issue, skipped: initial.skipped });
  const plansRef = useRef(initial.plans);

  const commit = useCallback((next) => {
    plansRef.current = next;
    setPlans(next);
    return saveStudyPlans(next);
  }, []);

  /** Save a freshly generated plan. @returns {{record: object | null, saved: boolean}} */
  const addPlan = useCallback(
    (plan, config) => {
      if (!canAddPlan(plansRef.current)) {
        return { record: null, saved: false };
      }

      const record = createPlanRecord(plan, config);
      return { record, saved: commit(addPlanRecord(plansRef.current, record)) };
    },
    [commit]
  );

  /** Replace the schedule of one plan after a successful regeneration. */
  const replacePlan = useCallback(
    (id, plan, config) => ({ saved: commit(replacePlanContent(plansRef.current, id, plan, config)) }),
    [commit]
  );

  /** Tick or untick one task of one plan. */
  const toggleTask = useCallback(
    (id, taskId, completed) => {
      const record = plansRef.current.find((item) => item.id === id);

      if (!record) {
        return { saved: true };
      }

      const nextPlan = setTaskCompleted(record.plan, taskId, completed);
      return nextPlan === record.plan ? { saved: true } : { saved: commit(updatePlanInRecords(plansRef.current, id, nextPlan)) };
    },
    [commit]
  );

  const deletePlan = useCallback((id) => ({ saved: commit(removePlanRecord(plansRef.current, id)) }), [commit]);

  const dismissLoadIssue = useCallback(() => setLoadIssue(null), []);

  return { plans, loadIssue, dismissLoadIssue, canAddMore: canAddPlan(plans), addPlan, replacePlan, toggleTask, deletePlan };
}
