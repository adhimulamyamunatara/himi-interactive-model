import { useId } from 'react';

/**
 * Pill-style single choice built on native radio inputs, so arrow-key navigation and
 * screen-reader semantics work without extra code.
 *
 * @param {object} props
 * @param {string} props.legend Visible group label.
 * @param {Array<{value: string | number, label: string}>} props.options
 * @param {string | number} props.value
 * @param {(value: string | number) => void} props.onChange
 */
export default function SegmentedControl({ legend, options, value, onChange, disabled = false, error, className = '' }) {
  const name = useId();

  return (
    <fieldset className={`min-w-0 ${className}`} disabled={disabled}>
      <legend className="mb-2 text-sm font-medium text-slate-700">{legend}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <label key={option.value} className="relative block cursor-pointer has-[:disabled]:cursor-not-allowed">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="block rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-slate-50 peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700 peer-focus-visible:ring-4 peer-focus-visible:ring-blue-200 peer-disabled:opacity-60">
              {option.label}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p className="mt-2 text-xs font-medium text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
