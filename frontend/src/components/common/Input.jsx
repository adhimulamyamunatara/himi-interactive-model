export default function Input({ label, icon: Icon, className = '', ...props }) {
  return (
    <label className={`flex w-full flex-col gap-2 text-sm font-medium text-slate-700 ${className}`}>
      {label && <span>{label}</span>}
      <div className="flex items-center rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 transition focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100">
        {Icon ? <Icon className="mr-3 text-slate-400" /> : null}
        <input className="w-full bg-transparent outline-none placeholder:text-slate-400" {...props} />
      </div>
    </label>
  );
}