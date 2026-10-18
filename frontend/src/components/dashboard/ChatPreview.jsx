import { Link } from 'react-router-dom';
import { SubjectBadge } from '../common/Badge';

/** Compact summary of a past question or subject. */
export default function ChatPreview({ title, subject, time, to = '/chat' }) {
  return (
    <Link
      to={to}
      className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 transition hover:border-blue-200 hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
    >
      <p className="line-clamp-2 text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <SubjectBadge subject={subject} />
        <span className="text-xs text-slate-500">{time}</span>
      </div>
    </Link>
  );
}
