export default function ChatPreview({ title, subtitle, time }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
      </div>
      <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {time}
      </span>
    </div>
  );
}