import BrandLogo from '../common/BrandLogo';

const SIZES = {
  sm: { box: 'h-9 w-9 rounded-xl p-1', logo: 'h-full' },
  md: { box: 'h-16 w-16 rounded-2xl p-2', logo: 'h-full' },
  lg: { box: 'h-28 w-28 rounded-[2rem] p-3.5', logo: 'h-full' }
};

/**
 * HIMI mentor avatar: the logo's robot-and-book mark on a soft brand surface.
 * `sm` is used beside chat messages, `lg` in hero panels.
 */
export default function AssistantAvatar({ size = 'lg', className = '' }) {
  const config = SIZES[size];

  return (
    <div
      role="img"
      aria-label="HIMI mentor"
      className={`relative flex shrink-0 items-center justify-center bg-gradient-to-br from-white to-blue-50 shadow-glow-soft ring-1 ring-blue-100 ${config.box} ${className}`}
    >
      <BrandLogo variant="mark" alt="" className={config.logo} />
    </div>
  );
}
