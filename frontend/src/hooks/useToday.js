import { useEffect, useState } from 'react';
import { getTodayString } from '../utils/studyPlanner';

/**
 * The student's local calendar date, refreshed when the tab becomes visible again so a page left
 * open overnight does not keep showing yesterday's "today".
 */
export function useToday() {
  const [today, setToday] = useState(() => getTodayString());

  useEffect(() => {
    const refresh = () => setToday(getTodayString());

    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);

    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return today;
}
