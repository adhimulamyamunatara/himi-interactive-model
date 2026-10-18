const SIZES = {
  sm: { box: 'h-9 w-9 rounded-xl', letter: 'text-sm', inset: 'inset-1', showLabel: false },
  md: { box: 'h-16 w-16 rounded-2xl', letter: 'text-2xl', inset: 'inset-1.5', showLabel: false },
  lg: { box: 'h-28 w-28 rounded-[2rem]', letter: 'text-4xl', inset: 'inset-3', showLabel: true }
};

/** HIMI mentor mark. `sm` is used beside chat messages, `lg` in hero panels. */
export default function AssistantAvatar({ size = 'lg', className = '' }) {
  const config = SIZES[size];

  return (
    <div
      role="img"
      aria-label="HIMI mentor"
      className={`relative flex shrink-0 items-center justify-center bg-brand-gradient shadow-glow ${config.box} ${className}`}
    >
      <div className={`absolute ${config.inset} rounded-[inherit] border border-white/30 bg-white/10`} />
      <div className="relative flex flex-col items-center text-white">
        <span className={`${config.letter} font-black tracking-tight`}>H</span>
        {config.showLabel ? <span className="mt-1 text-xs uppercase tracking-[0.35em]">HIMI</span> : null}
      </div>
    </div>
  );
}
