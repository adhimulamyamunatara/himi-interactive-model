import { useId } from 'react';
import { motion } from 'framer-motion';
import { chartColors } from '../../styles/tokens';

/**
 * Animated circular progress indicator.
 *
 * @param {object} props
 * @param {number} props.value Percentage between 0 and 100.
 * @param {number} [props.size] Diameter in pixels.
 * @param {number} [props.strokeWidth]
 */
export default function ProgressRing({ value, size = 140, strokeWidth = 12, label, caption }) {
  const gradientId = `ring-${useId().replace(/:/g, '')}`;
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ?? 'Progress'}: ${Math.round(clamped)} percent`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={chartColors.ringStops[0]} />
            <stop offset="55%" stopColor={chartColors.ringStops[1]} />
            <stop offset="100%" stopColor={chartColors.ringStops[2]} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={chartColors.ringTrack} strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped / 100) }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-black text-slate-900">{Math.round(clamped)}%</span>
        {caption ? <span className="mt-0.5 text-xs font-medium text-slate-500">{caption}</span> : null}
      </div>
    </div>
  );
}
