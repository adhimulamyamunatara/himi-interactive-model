import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import Button from './Button';

/** Friendly full-width error panel with an optional retry action. */
export default function ErrorState({
  title = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  actionLabel = 'Try again',
  onAction
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-3xl border border-rose-100 bg-rose-50/60 px-6 py-12 text-center"
    >
      <div className="mb-4 rounded-2xl bg-white p-4 text-2xl text-rose-500 shadow-card">
        <FiAlertTriangle aria-hidden="true" />
      </div>
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      {onAction ? (
        <Button className="mt-6" variant="secondary" onClick={onAction}>
          <FiRefreshCw aria-hidden="true" /> {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
