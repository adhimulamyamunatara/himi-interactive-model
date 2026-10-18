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
  horizontal: { src: '/himi-logo-horizontal.png', width: 405, height: 206 },
  mark: { src: '/himi-mark.png', width: 274, height: 237 },
  full: { src: '/himi-logo-full.png', width: 479, height: 548 }
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
      // The artwork has navy letters, so on the dark theme it sits on a soft white plate to stay readable.
      className={`w-auto select-none object-contain dark:rounded-2xl dark:bg-white/95 dark:p-1 ${className}`}
      {...props}
    />
  );
}
