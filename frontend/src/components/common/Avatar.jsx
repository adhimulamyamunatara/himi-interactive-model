import { getInitials } from '../../utils/formatters';

const SIZES = {
  sm: 'h-10 w-10 rounded-2xl text-sm',
  md: 'h-14 w-14 rounded-2xl text-base',
  lg: 'h-20 w-20 rounded-3xl text-xl',
  xl: 'h-28 w-28 rounded-[2rem] text-3xl'
};

/** Gradient initials avatar used as a profile picture placeholder. */
export default function Avatar({ name = '', size = 'md', className = '' }) {
  return (
    <div
      role="img"
      aria-label={name ? `Avatar for ${name}` : 'Avatar'}
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-400 font-bold text-white shadow-card ${SIZES[size]} ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}
