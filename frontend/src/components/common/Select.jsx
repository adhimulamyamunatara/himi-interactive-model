import { useId } from 'react';

/**
 * Labelled native select. Use `hideLabel` for compact toolbars (label stays available to screen readers).
 */
export default function Select({ label, hideLabel = false, className = '', children, id, ...props }) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className={`flex w-full flex-col gap-2 ${className}`}>
      {label ? (
        <label htmlFor={selectId} className={hideLabel ? 'sr-only' : 'text-sm font-medium text-slate-700'}>
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
