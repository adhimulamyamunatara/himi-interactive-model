export default function Textarea({ label, className = '', ...props }) {
  return (
    <label className={`flex w-full flex-col gap-2 text-sm font-medium text-slate-700 ${className}`}>
      {label && <span>{label}</span>}
      <textarea
        className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        {...props}
      />
    </label>
  );
}