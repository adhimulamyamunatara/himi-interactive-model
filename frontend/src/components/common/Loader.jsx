export default function Loader({ label = 'Loading' }) {
  return (
    <div className="inline-flex items-center gap-2 text-sm text-slate-500" role="status">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500" />
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-500 [animation-delay:150ms]" />
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-500 [animation-delay:300ms]" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
