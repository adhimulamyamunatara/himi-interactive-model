import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';

const CLASSES =
  'group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 transition hover:border-blue-200 hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200';

/** Row-style shortcut that navigates (`to`) or runs an action (`onClick`). */
export default function QuickAction({ icon: Icon, label, description, to, onClick }) {
  const content = (
    <>
      <span className="rounded-xl bg-blue-50 p-2.5 text-lg text-blue-600 transition group-hover:bg-blue-100">
        <Icon aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {description ? <span className="mt-0.5 block text-xs font-normal text-slate-500">{description}</span> : null}
      </span>
      <FiArrowRight className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600" aria-hidden="true" />
    </>
  );

  if (to) {
    return (
      <Link to={to} className={CLASSES}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={CLASSES}>
      {content}
    </button>
  );
}
