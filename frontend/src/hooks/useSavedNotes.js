import { useCallback, useState } from 'react';
import { createId } from '../utils/chatConversations';
import {
  addSummaryRecord,
  canAddSummary,
  clearSavedSummaries,
  createSummaryRecord,
  loadSavedSummaries,
  removeSummaryRecord,
  saveSummaries
} from '../utils/notesStorage';


/** Saved summaries (this browser only). Each action reports whether the browser accepted the write. */
export function useSavedNotes() {
  const [initial] = useState(() => loadSavedSummaries());
  const [records, setRecords] = useState(initial.records);
  const [issue, setIssue] = useState(initial.issue);

  const save = useCallback(
    ({ title, fileName, pageCount, notes }) => {
      if (!canAddSummary(records)) {
        return { ok: false, reason: 'full', id: null };
      }

      const record = createSummaryRecord({ id: createId(), title, fileName, pageCount, notes });

      if (!record) {
        return { ok: false, reason: 'invalid', id: null };
      }

      const next = addSummaryRecord(records, record);
      setRecords(next);
      return { ok: saveSummaries(next), reason: 'storage', id: record.id };
    },
    [records]
  );

  const remove = useCallback(
    (id) => {
      const next = removeSummaryRecord(records, id);
      setRecords(next);
      return saveSummaries(next);
    },
    [records]
  );

  const clearAll = useCallback(() => {
    setRecords([]);
    setIssue(null);
    return clearSavedSummaries();
  }, []);

  return { records, issue, dismissIssue: () => setIssue(null), save, remove, clearAll };
}
