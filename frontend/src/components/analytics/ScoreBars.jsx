import ProgressBar from '../common/ProgressBar';

/**
 * A labelled list of horizontal bars. Every bar prints its number, so the chart never relies on colour or length alone.
 *
 * @param {{label: string, value: number, valueText: string, caption?: string}[]} props.rows `value` is 0-100.
 */
export default function ScoreBars({ rows, label }) {
  return (
    <ul className="space-y-4" aria-label={label}>
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-slate-800">{row.label}</span>
            <span className="shrink-0 font-semibold text-slate-950">{row.valueText}</span>
          </div>
          <ProgressBar percentage={row.value} label={`${row.label}: ${row.valueText}`} />
          {row.caption ? <p className="mt-1 text-xs text-slate-500">{row.caption}</p> : null}
        </li>
      ))}
    </ul>
  );
}
