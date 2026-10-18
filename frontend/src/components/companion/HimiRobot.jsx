import { useId } from 'react';
import { ROBOT_STATES } from '../../utils/companionState';

/**
 * The HIMI robot as lightweight SVG, drawn after the logo's mascot (blue-to-violet head with a cap and
 * headphones, a light face screen with navy eyes, an open book, and the green/blue/violet "rays").
 * The full logo PNG is still used for static brand placements; this exists so the face can move.
 *
 * It is purely presentational: `state` comes from `deriveRobotState`, so what moves is always what is really
 * happening. Every state has a shape of its own (a different mouth, brows, eyes and badge icon), so the state
 * never depends on animation or colour alone, and with reduced motion the poses stay while the loops stop.
 * The mouth moving while "speaking" is a generic loop that runs only while audio plays; it is not lip-sync.
 *
 * Animations live in `styles/index.css` under `.himi-robot`.
 */

const FACE = '#f4f8ff';
const NAVY = '#14308f';

function Eyes({ state }) {
  if (state === 'celebrating') {
    // Happy closed eyes.
    return (
      <g fill="none" stroke={NAVY} strokeWidth="4" strokeLinecap="round">
        <path d="M74 106 Q82 94 90 106" />
        <path d="M110 106 Q118 94 126 106" />
      </g>
    );
  }

  const ry = state === 'error' ? 8 : state === 'listening' ? 11.5 : 10;
  const rx = state === 'listening' ? 9.5 : 8.5;

  return (
    <g className="himi-eyes">
      {[82, 118].map((cx) => (
        <g key={cx} className="himi-eye">
          <ellipse cx={cx} cy="104" rx={rx} ry={ry} fill={NAVY} />
          <circle cx={cx + 3} cy="100" r="3" fill="#ffffff" />
          <circle cx={cx - 3} cy="109" r="1.4" fill="#ffffff" opacity="0.8" />
        </g>
      ))}
    </g>
  );
}

function Brows({ state }) {
  const left = state === 'thinking' ? 'M72 88 Q82 80 92 86' : state === 'error' ? 'M72 90 Q82 92 92 86' : 'M72 90 Q82 84 92 90';
  const right = state === 'thinking' ? 'M108 88 Q118 78 128 84' : state === 'error' ? 'M108 86 Q118 92 128 90' : 'M108 90 Q118 84 128 90';

  return (
    <g className="himi-brows" fill="none" stroke={NAVY} strokeWidth="3" strokeLinecap="round">
      <path d={left} />
      <path d={right} />
    </g>
  );
}

function Mouth({ state }) {
  if (state === 'speaking') {
    return <ellipse className="himi-mouth-open" cx="100" cy="124" rx="7" ry="6" fill={NAVY} />;
  }

  if (state === 'error') {
    return <path d="M91 127 Q100 119 109 127" fill="none" stroke={NAVY} strokeWidth="3.4" strokeLinecap="round" />;
  }

  if (state === 'thinking') {
    return <path d="M93 124 L107 124" fill="none" stroke={NAVY} strokeWidth="3.4" strokeLinecap="round" />;
  }

  if (state === 'listening') {
    return <ellipse cx="100" cy="124" rx="4" ry="3.4" fill={NAVY} />;
  }

  const wide = state === 'celebrating';

  return (
    <path
      d={wide ? 'M88 118 Q100 134 112 118 Z' : 'M91 120 Q100 128 109 120'}
      fill={wide ? NAVY : 'none'}
      stroke={NAVY}
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** A small icon in a ring at the robot's shoulder: a second, non-animated cue for the state. */
function Badge({ state }) {
  if (state === 'idle') {
    return null;
  }

  const ring = { listening: '#e11d48', thinking: '#7c3aed', speaking: '#2563eb', teaching: '#059669', celebrating: '#d97706', error: '#dc2626' }[state];
  const icon = {
    listening: (
      <g fill="none" stroke={ring} strokeWidth="2.4" strokeLinecap="round">
        <rect x="-3" y="-8" width="6" height="11" rx="3" fill={ring} stroke="none" />
        <path d="M-7 -1 Q-7 7 0 7 Q7 7 7 -1" />
        <path d="M0 7 V10" />
      </g>
    ),
    thinking: (
      <g fill={ring}>
        <circle className="himi-dot himi-dot-1" cx="-6" cy="0" r="2.6" />
        <circle className="himi-dot himi-dot-2" cx="0" cy="0" r="2.6" />
        <circle className="himi-dot himi-dot-3" cx="6" cy="0" r="2.6" />
      </g>
    ),
    speaking: (
      <g fill="none" stroke={ring} strokeWidth="2.4" strokeLinecap="round">
        <path className="himi-wave himi-wave-1" d="M-6 -3 V3" />
        <path className="himi-wave himi-wave-2" d="M0 -7 V7" />
        <path className="himi-wave himi-wave-3" d="M6 -4 V4" />
      </g>
    ),
    teaching: (
      <g fill="none" stroke={ring} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M-8 -6 Q-3 -8 0 -5 Q3 -8 8 -6 V6 Q3 4 0 7 Q-3 4 -8 6 Z" />
        <path d="M0 -5 V7" />
      </g>
    ),
    celebrating: <path d="M0 -9 L2.6 -2.8 L9 -2.4 L4 1.8 L5.8 8.2 L0 4.6 L-5.8 8.2 L-4 1.8 L-9 -2.4 L-2.6 -2.8 Z" fill={ring} />,
    error: (
      <g fill={ring}>
        <rect x="-2" y="-9" width="4" height="11" rx="2" />
        <circle cx="0" cy="6.5" r="2.4" />
      </g>
    )
  }[state];

  return (
    <g className="himi-badge" transform="translate(160 152)">
      <circle r="15" fill="#ffffff" stroke={ring} strokeWidth="3" />
      {icon}
    </g>
  );
}

export default function HimiRobot({ state = 'idle', className = 'h-40 w-40', label, decorative = false }) {
  const safeState = ROBOT_STATES.includes(state) ? state : 'idle';
  const uid = useId().replace(/:/g, '');
  const head = `himi-head-${uid}`;
  const ear = `himi-ear-${uid}`;
  const pageA = `himi-page-a-${uid}`;
  const pageB = `himi-page-b-${uid}`;

  return (
    <svg
      viewBox="0 0 200 200"
      className={`himi-robot ${className}`}
      data-state={safeState}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? 'true' : undefined}
      focusable="false"
    >
      <defs>
        <linearGradient id={head} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#2cc8ff" />
          <stop offset="0.5" stopColor="#3b7bff" />
          <stop offset="1" stopColor="#6a4bff" />
        </linearGradient>
        <linearGradient id={ear} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b6bff" />
          <stop offset="1" stopColor="#5b3fe0" />
        </linearGradient>
        <linearGradient id={pageA} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#12d6f0" />
          <stop offset="1" stopColor="#2f7bff" />
        </linearGradient>
        <linearGradient id={pageB} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2fe39a" />
          <stop offset="1" stopColor="#19a6c8" />
        </linearGradient>
      </defs>

      {/* Rays, as in the logo. They pulse while listening and burst while celebrating. */}
      <g className="himi-rays" strokeWidth="9" strokeLinecap="round" fill="none">
        <path className="himi-ray himi-ray-1" d="M24 52 L40 64" stroke="#22d3a0" />
        <path className="himi-ray himi-ray-2" d="M14 94 H34" stroke="#2f8bff" />
        <path className="himi-ray himi-ray-3" d="M176 52 L160 64" stroke="#22d3a0" />
        <path className="himi-ray himi-ray-4" d="M186 94 H166" stroke="#6a5cff" />
      </g>

      <g className="himi-body">
        {/* Open book */}
        <g className="himi-book">
          <path d="M100 176 L100 154 Q70 140 38 148 L44 172 Q74 164 100 176 Z" fill={`url(#${pageA})`} />
          <path d="M100 176 L100 154 Q130 140 162 148 L156 172 Q126 164 100 176 Z" fill={`url(#${pageB})`} />
        </g>

        {/* Headphones */}
        <rect x="34" y="84" width="20" height="46" rx="10" fill={`url(#${ear})`} />
        <rect x="146" y="84" width="20" height="46" rx="10" fill={`url(#${ear})`} />

        {/* Head */}
        <rect x="46" y="58" width="108" height="98" rx="42" fill={`url(#${head})`} />
        <rect x="59" y="76" width="82" height="58" rx="25" fill={FACE} />

        <Brows state={safeState} />
        <Eyes state={safeState} />
        <Mouth state={safeState} />

        {/* Graduation cap */}
        <rect x="70" y="46" width="60" height="20" rx="9" fill="#2352d9" />
        <path d="M100 14 L158 34 L100 54 L42 34 Z" fill="#1d44c4" />
        <path d="M100 14 L158 34 L100 54 L42 34 Z" fill="none" stroke="#3b6bff" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M150 37 V62" stroke="#1d44c4" strokeWidth="3" strokeLinecap="round" />
        <rect x="146.5" y="60" width="7" height="12" rx="3" fill="#1d44c4" />
      </g>

      {safeState === 'celebrating' ? (
        <g className="himi-confetti" fill="none">
          <path className="himi-spark himi-spark-1" d="M30 30 L33 38 L41 41 L33 44 L30 52 L27 44 L19 41 L27 38 Z" fill="#fbbf24" />
          <path className="himi-spark himi-spark-2" d="M172 22 L174 28 L180 30 L174 32 L172 38 L170 32 L164 30 L170 28 Z" fill="#22d3a0" />
          <path className="himi-spark himi-spark-3" d="M184 120 L186 126 L192 128 L186 130 L184 136 L182 130 L176 128 L182 126 Z" fill="#ec4899" />
          <circle className="himi-spark himi-spark-4" cx="18" cy="132" r="4" fill="#60a5fa" />
        </g>
      ) : null}

      <Badge state={safeState} />
    </svg>
  );
}
