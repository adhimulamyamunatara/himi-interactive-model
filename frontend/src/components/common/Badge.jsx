import { getSubjectTone } from '../../utils/subjects';

const TONES = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  purple: 'bg-violet-50 text-violet-700 ring-violet-100',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-800 ring-amber-100',
  rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200'
};

export default function Badge({ children, tone = 'blue', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Badge whose colour is derived from the subject name. */
export function SubjectBadge({ subject, className = '' }) {
  return (
    <Badge tone={getSubjectTone(subject)} className={className}>
      {subject}
    </Badge>
  );
}
