/** Thin horizontal progress bar. `percentage` is 0-100; `label` names it for screen readers. */
export default function ProgressBar({ percentage, label, className = '' }) {
  const clamped = Math.min(100, Math.max(0, percentage));

  return (
    <div
      className={`h-2 overflow-hidden rounded-full bg-slate-100 ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
    >
      <div className="h-full rounded-full bg-learn-gradient transition-all duration-500" style={{ width: `${clamped}%` }} />
    </div>
  );
}
