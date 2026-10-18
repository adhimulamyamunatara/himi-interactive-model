import { useId } from 'react';
import { chartColors } from '../../styles/tokens';
import { REVISION_THRESHOLD } from '../../utils/analytics';
import { formatPlanDate } from '../../utils/studyPlanner';

const WIDTH = 640;
const HEIGHT = 240;
const PAD = { top: 16, right: 24, bottom: 36, left: 40 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

const x = (index, count) => PAD.left + (count === 1 ? PLOT_W / 2 : (index / (count - 1)) * PLOT_W);
const y = (percentage) => PAD.top + PLOT_H - (percentage / 100) * PLOT_H;
const round = (value) => Math.round(value);

/**
 * Line chart of quiz scores over time, drawn with SVG (no chart library).
 * Accessible: the chart has a text description, and the exact values are available as a table.
 * Meaning never depends on colour alone: every point is also listed with its date, subject and score.
 */
export default function ScoreTrendChart({ points }) {
  const titleId = useId();
  const descriptionId = useId();
  const description = `Your last ${points.length} quiz score${points.length === 1 ? '' : 's'}, oldest first: ${points
    .map((point) => `${round(point.percentage)} percent in ${point.subject}`)
    .join(', ')}.`;
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index, points.length)},${y(point.percentage)}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${titleId} ${descriptionId}`} className="h-auto w-full">
        <title id={titleId}>Quiz scores over time</title>
        <desc id={descriptionId}>{description}</desc>

        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} stroke={chartColors.grid} strokeWidth="1" />
            <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill={chartColors.axis}>
              {tick}%
            </text>
          </g>
        ))}

        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={y(REVISION_THRESHOLD)}
          y2={y(REVISION_THRESHOLD)}
          stroke={chartColors.threshold}
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
        <text x={WIDTH - PAD.right} y={y(REVISION_THRESHOLD) - 5} textAnchor="end" fontSize="10" fill={chartColors.thresholdLabel}>
          {REVISION_THRESHOLD}% revision line
        </text>

        {points.length > 1 ? <path d={path} fill="none" stroke={chartColors.line} strokeWidth="2.5" strokeLinejoin="round" /> : null}

        {points.map((point, index) => (
          <g key={point.id}>
            <circle cx={x(index, points.length)} cy={y(point.percentage)} r="5" fill={chartColors.line} stroke="#fff" strokeWidth="2" />
            {points.length <= 8 || index === points.length - 1 ? (
              <text x={x(index, points.length)} y={y(point.percentage) - 10} textAnchor="middle" fontSize="11" fontWeight="600" fill={chartColors.label}>
                {round(point.percentage)}%
              </text>
            ) : null}
            {points.length <= 8 || index === 0 || index === points.length - 1 ? (
              <text x={x(index, points.length)} y={HEIGHT - 12} textAnchor="middle" fontSize="10" fill={chartColors.axis}>
                {formatPlanDate(point.date, 'short')}
              </text>
            ) : null}
          </g>
        ))}
      </svg>

      <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">View these scores as a table</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Quiz scores over time</caption>
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-1 pr-4">Date</th>
                <th scope="col" className="py-1 pr-4">Subject</th>
                <th scope="col" className="py-1 pr-4">Topic</th>
                <th scope="col" className="py-1">Score</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.id} className="border-t border-slate-200">
                  <td className="py-1.5 pr-4">{formatPlanDate(point.date, 'short')}</td>
                  <td className="py-1.5 pr-4">{point.subject}</td>
                  <td className="py-1.5 pr-4">{point.topic ?? 'Whole subject'}</td>
                  <td className="py-1.5 font-semibold">{round(point.percentage)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
