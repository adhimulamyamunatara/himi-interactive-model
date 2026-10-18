import { useId } from 'react';

/**
 * Labelled text input with optional leading icon and inline error message.
 */
export default function Input({ label, icon: Icon, error, hint, className = '', id, ...props }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={`flex w-full flex-col gap-2 ${className}`}>
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      ) : null}
      <div
        className={`flex items-center rounded-2xl border bg-white/80 px-4 py-3 text-slate-900 transition focus-within:ring-4 ${
          error
            ? 'border-rose-300 focus-within:border-rose-400 focus-within:ring-rose-100'
            : 'border-slate-200 focus-within:border-blue-400 focus-within:ring-blue-100'
        }`}
      >
        {Icon ? <Icon className="mr-3 shrink-0 text-slate-400" aria-hidden="true" /> : null}
        <input
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          {...props}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-xs font-medium text-rose-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
