import { useCallback, useState } from 'react';
import { clearQuizAttempts, loadQuizAttempts } from '../utils/analyticsStorage';
import { loadStudyPlans } from '../utils/studyPlanStorage';

/**
 * Everything the progress page shows, read from this browser:
 * - quiz attempts (this feature's own store), and
 * - the saved study plans (the planner's store, read only).
 * Read once when the page opens, so it always reflects what the other pages saved.
 */
export function useProgressData() {
  const [initial] = useState(() => ({ quizzes: loadQuizAttempts(), plans: loadStudyPlans() }));
  const [attempts, setAttempts] = useState(initial.quizzes.attempts);
  const [issue, setIssue] = useState(initial.quizzes.issue);

  const clearQuizHistory = useCallback(() => {
    const ok = clearQuizAttempts();
    setAttempts([]);
    setIssue(null);
    return ok;
  }, []);

  return {
    attempts,
    plans: initial.plans.plans,
    issue,
    planIssue: initial.plans.issue,
    dismissIssue: () => setIssue(null),
    clearQuizHistory
  };
}
