import { FiCheck } from 'react-icons/fi';

/**
 * Toggle chip built on a native checkbox, so Space toggles it and screen readers announce its state.
 * Use inside a `<fieldset>` with a `<legend>` to label the group.
 */
export default function ChipCheckbox({ label, checked, onChange, disabled = false, className = '' }) {
  return (
    <label className={`relative block cursor-pointer has-[:disabled]:cursor-not-allowed ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-slate-50 peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700 peer-focus-visible:ring-4 peer-focus-visible:ring-blue-200 peer-disabled:opacity-60">
        <FiCheck aria-hidden="true" className={`shrink-0 transition ${checked ? 'opacity-100' : 'hidden'}`} />
        {label}
      </span>
    </label>
  );
}
