import { useId } from 'react';

/**
 * Labelled multi-line input with a character counter, matching `Input`.
 * Pass `maxLength` to show "n/max"; the counter turns red when the limit is exceeded
 * (the field itself is not hard-capped, so validation can explain what to shorten).
 */
export default function Textarea({ label, error, hint, maxLength, value = '', className = '', id, rows = 3, ...props }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  const overLimit = maxLength !== undefined && value.length > maxLength;

  return (
    <div className={`flex w-full flex-col gap-2 ${className}`}>
      {label ? (
        <label htmlFor={fieldId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      ) : null}
      <textarea
        id={fieldId}
        rows={rows}
        value={value}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={`w-full resize-y rounded-2xl border bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
          error
            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
            : 'border-slate-200 focus:border-blue-400 focus:ring-blue-100'
        }`}
        {...props}
      />
      <div className="flex items-start justify-between gap-3">
        {error ? (
          <p id={`${fieldId}-error`} className="text-xs font-medium text-rose-600" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p id={`${fieldId}-hint`} className="text-xs text-slate-500">
            {hint}
          </p>
        ) : (
          <span />
        )}
        {maxLength !== undefined ? (
          <p className={`shrink-0 text-xs ${overLimit ? 'font-semibold text-rose-600' : 'text-slate-400'}`} aria-hidden="true">
            {value.length}/{maxLength}
          </p>
        ) : null}
      </div>
    </div>
  );
}
