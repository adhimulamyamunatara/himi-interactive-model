import { SubjectBadge } from '../common/Badge';

/** One entry in the recent chats list. */
export default function SidebarItem({ title, subject, time, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-transparent bg-slate-50/80 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/70"
    >
      <p className="line-clamp-2 text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <SubjectBadge subject={subject} />
        <span className="shrink-0 text-xs text-slate-500">{time}</span>
      </div>
    </button>
  );
}
