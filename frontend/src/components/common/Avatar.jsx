import { useState } from 'react';
import { getAvatarColorClasses } from '../../utils/avatar';
import { getInitials } from '../../utils/formatters';

const SIZES = {
  sm: 'h-10 w-10 rounded-2xl text-sm',
  md: 'h-14 w-14 rounded-2xl text-base',
  lg: 'h-20 w-20 rounded-3xl text-xl',
  xl: 'h-28 w-28 rounded-[2rem] text-3xl'
};

/**
 * Profile picture. Shows the student's photo when there is one and it loads, otherwise coloured initials.
 * A missing, invalid or broken image silently falls back to the initials, so the avatar never looks broken.
 */
export default function Avatar({ name = '', image = '', color, size = 'md', className = '' }) {
  const [failedImage, setFailedImage] = useState('');
  const showImage = Boolean(image) && failedImage !== image;
  const base = `shrink-0 shadow-card ${SIZES[size]} ${className}`;

  if (showImage) {
    return (
      <img
        src={image}
        alt={name ? `Profile photo of ${name}` : 'Profile photo'}
        width={160}
        height={160}
        draggable="false"
        onError={() => setFailedImage(image)}
        className={`${base} bg-slate-100 object-cover`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name ? `Avatar for ${name}` : 'Avatar'}
      className={`flex items-center justify-center bg-gradient-to-br font-bold text-white ${getAvatarColorClasses(color)} ${base}`}
    >
      {getInitials(name)}
    </div>
  );
}
