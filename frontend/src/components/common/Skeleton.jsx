/** Shimmering placeholder block. Size it with Tailwind classes, e.g. `h-4 w-1/2`. */
export default function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function CardSkeleton({ lines = 3, className = '' }) {
  return (
    <div className={`section-card space-y-4 p-6 ${className}`} aria-hidden="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-2/3" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={`h-3 ${index === lines - 1 ? 'w-1/2' : 'w-full'}`} />
      ))}
    </div>
  );
}

/** Full-page fallback used while lazy routes load or the session is being restored. */
export function PageSkeleton() {
  return (
    <div className="section-shell space-y-6 py-10 lg:py-14" role="status" aria-label="Loading page">
      <CardSkeleton lines={2} className="h-44" />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <CardSkeleton key={index} lines={1} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
