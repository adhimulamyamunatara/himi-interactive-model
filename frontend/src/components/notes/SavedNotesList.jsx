import { FiEye, FiTrash2 } from 'react-icons/fi';
import { formatRelativeTime } from '../../utils/formatters';
import Button from '../common/Button';

/** Summaries saved on this device. Only summaries are listed: PDFs and their text are never stored. */
export default function SavedNotesList({ records, onView, onDelete, onClearAll }) {
  return (
    <div>
      <ul className="space-y-3" aria-label="Saved summaries">
        {records.map((record) => (
          <li key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{record.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Saved {formatRelativeTime(record.createdAt)}
                {record.pageCount ? ` · ${record.pageCount} page${record.pageCount === 1 ? '' : 's'}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => onView(record)} aria-label={`View summary: ${record.title}`}>
                <FiEye aria-hidden="true" /> View
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(record)} aria-label={`Delete summary: ${record.title}`}>
                <FiTrash2 aria-hidden="true" /> Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {records.length > 1 ? (
        <Button variant="ghost" size="sm" className="mt-3" onClick={onClearAll}>
          Delete all saved summaries
        </Button>
      ) : null}
    </div>
  );
}
