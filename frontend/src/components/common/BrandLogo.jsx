/**
 * The HIMI logo, rendered from derivatives of `public/HIMI AI Learning Companion Logo.png`.
 *
 * The derivatives are exact crops of the supplied artwork (never redrawn), so the aspect ratio is
 * preserved: pass a height class and the width follows. All variants have a transparent background.
 *
 * - `horizontal`: mark + wordmark, for headers and footers.
 * - `mark`: the robot-and-book emblem on its own, for tight spaces and avatars.
 * - `full`: emblem, wordmark and tagline, for hero and sign-in areas.
 */
const VARIANTS = {
  horizontal: { src: '/himi-logo-horizontal.png', width: 409, height: 205 },
  mark: { src: '/himi-mark.png', width: 270, height: 241 },
  full: { src: '/himi-logo-full.png', width: 517, height: 548 }
};

export default function BrandLogo({ variant = 'horizontal', className = 'h-10', alt = 'HIMI, your AI learning companion', ...props }) {
  const { src, width, height } = VARIANTS[variant] ?? VARIANTS.horizontal;

  return (
    <img
      src={src}
      width={width}
      height={height}
      alt={alt}
      draggable="false"
      decoding="async"
      className={`w-auto select-none object-contain ${className}`}
      {...props}
    />
  );
}
