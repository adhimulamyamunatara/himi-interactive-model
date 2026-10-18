/**
 * HIMI design tokens: the single source of truth for brand colour, gradients, shadows, radii and motion.
 *
 * Every value is derived from the supplied logo (`public/HIMI AI Learning Companion Logo.png`), sampled
 * pixel-by-pixel:
 *   navy wordmark   #0b2955   deep navy cap  #0e3472   tagline slate  #384b6b
 *   robot indigo    #364ee1   robot violet   #675bf9   sky blue       #2f95fb / #477ef7 / #2075dc
 *   book cyan       #14bbea   book green     #38cd93 / #1cb597         teal spark  #25bfb7
 *
 * `tailwind.config.js` turns these into Tailwind colours and CSS custom properties (`--himi-*`), so the
 * same values reach class names (`bg-blue-600`), plain CSS (`var(--himi-gradient-brand)`) and SVG charts
 * (`import { chartColors }`). Do not hard-code hex values in components; add a token here instead.
 *
 * The legacy Tailwind families (`slate`, `blue`, `indigo`, `violet`, `cyan`, `emerald`, `teal`) are
 * deliberately re-pointed at brand scales, so existing screens inherit the identity without churn:
 *   slate  = HIMI navy ink     blue    = primary brand blue    indigo = robot indigo
 *   violet = logo violet       cyan    = book cyan             emerald/teal = book green/teal
 * `amber` and `rose` stay as Tailwind defaults and carry the warning and error meanings.
 */

export const palette = {
  slate: {
    50: '#f5f8fc',
    100: '#eaf0f7',
    200: '#d9e2ee',
    300: '#b9c7da',
    400: '#8496b1',
    500: '#5b6f8f',
    600: '#46587a',
    700: '#34496c',
    800: '#1d3560',
    900: '#0b2955',
    950: '#071c3e'
  },
  blue: {
    50: '#eff5ff',
    100: '#dbe8ff',
    200: '#bdd5ff',
    300: '#8fb7fd',
    400: '#5c95fa',
    500: '#3d78f2',
    600: '#2f5fe3',
    700: '#284cc4',
    800: '#263f9c',
    900: '#233979',
    950: '#16224b'
  },
  indigo: {
    50: '#f0f2ff',
    100: '#e3e7ff',
    200: '#c9d0ff',
    300: '#a3aefc',
    400: '#7a86f7',
    500: '#5461ee',
    600: '#3f4ee0',
    700: '#3540c4',
    800: '#2f399d',
    900: '#2d357b',
    950: '#1b1f4b'
  },
  violet: {
    50: '#f4f2ff',
    100: '#ebe8ff',
    200: '#d9d4ff',
    300: '#bfb6ff',
    400: '#9588fb',
    500: '#675bf9',
    600: '#5646ea',
    700: '#4838cc',
    800: '#3b2fa6',
    900: '#302a80',
    950: '#1d1a4d'
  },
  cyan: {
    50: '#ecfbff',
    100: '#d0f4fd',
    200: '#a4e9fb',
    300: '#67d9f6',
    400: '#2cc7ef',
    500: '#14bbea',
    600: '#0c9ccb',
    700: '#0a6b8c',
    800: '#0f5775',
    900: '#124760',
    950: '#0a3345'
  },
  emerald: {
    50: '#ecfdf6',
    100: '#d1fae9',
    200: '#a5f3d3',
    300: '#6be5b8',
    400: '#38cd93',
    500: '#1cb597',
    600: '#11957c',
    700: '#0f7865',
    800: '#0f6052',
    900: '#0e4f44',
    950: '#062e28'
  },
  teal: {
    50: '#effcfb',
    100: '#d3f7f4',
    200: '#aaeeea',
    300: '#72dfdb',
    400: '#25bfb7',
    500: '#14a39f',
    600: '#0e8482',
    700: '#0f6a69',
    800: '#115454',
    900: '#124646',
    950: '#062b2c'
  }
};

/** Semantic roles, expressed as references into the palette above. */
export const semantic = {
  // Surfaces and text
  canvas: '#ffffff',
  surface: '#ffffff',
  'surface-muted': palette.slate[50],
  ink: palette.slate[900],
  'ink-muted': palette.slate[600],
  'ink-subtle': palette.slate[500],
  line: palette.slate[200],
  // Brand
  primary: palette.blue[600],
  secondary: palette.violet[500],
  accent: palette.cyan[500],
  'accent-green': palette.emerald[400],
  focus: palette.blue[600],
  // Status
  success: palette.emerald[600],
  warning: '#d97706',
  danger: '#e11d48',
  info: palette.blue[600]
};

export const gradients = {
  /** Robot body: sky blue through indigo to violet. Used for primary actions and AI surfaces. */
  brand: `linear-gradient(135deg, ${palette.blue[600]} 0%, ${palette.indigo[600]} 52%, ${palette.violet[500]} 100%)`,
  /** Wider sweep that also picks up the book's cyan. Used for headings, rings and hero accents. */
  spectrum: `linear-gradient(135deg, ${palette.blue[600]} 0%, ${palette.violet[500]} 55%, ${palette.cyan[500]} 100%)`,
  /** Open book: blue to cyan to green. Used for progress, success and learning milestones. */
  learn: `linear-gradient(90deg, ${palette.blue[500]} 0%, ${palette.cyan[500]} 55%, ${palette.emerald[400]} 100%)`,
  mesh:
    'radial-gradient(circle at top left, rgba(61, 120, 242, 0.16), transparent 30%), ' +
    'radial-gradient(circle at top right, rgba(103, 91, 249, 0.14), transparent 26%), ' +
    'radial-gradient(circle at bottom center, rgba(20, 187, 234, 0.14), transparent 30%)'
};

export const shadows = {
  soft: '0 24px 60px rgba(11, 41, 85, 0.12)',
  card: '0 10px 30px rgba(11, 41, 85, 0.06)',
  glow: '0 12px 40px rgba(63, 78, 224, 0.32)',
  'glow-soft': '0 8px 24px rgba(63, 78, 224, 0.18)'
};

export const radii = {
  control: '0.875rem',
  card: '1.5rem',
  panel: '2rem'
};

export const motion = {
  fast: '150ms',
  base: '220ms',
  slow: '420ms',
  ease: 'cubic-bezier(0.22, 1, 0.36, 1)'
};

/** Plain colours for SVG/canvas drawing code that cannot use class names. */
export const chartColors = {
  line: palette.blue[600],
  grid: palette.slate[200],
  axis: palette.slate[600],
  label: palette.slate[800],
  threshold: '#d97706',
  thresholdLabel: '#92400e',
  ringTrack: palette.slate[200],
  ringStops: [palette.blue[600], palette.violet[500], palette.cyan[500]]
};

/** Parse "#rrggbb" into "r g b" (the channel form Tailwind's `<alpha-value>` placeholder needs). */
export function hexToChannels(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);

  if (!match) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }

  const value = parseInt(match[1], 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

/** WCAG 2.x relative luminance of "#rrggbb". */
export function relativeLuminance(hex) {
  return hexToChannels(hex)
    .split(' ')
    .map((part) => {
      const channel = Number(part) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

/** WCAG contrast ratio between two "#rrggbb" colours. */
export function contrastRatio(foreground, background) {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Every token as a `--himi-*` CSS custom property. Colours use the space-separated channel form. */
export function buildCssVariables() {
  const vars = {};

  for (const [family, scale] of Object.entries(palette)) {
    for (const [shade, hex] of Object.entries(scale)) {
      vars[`--himi-${family}-${shade}`] = hexToChannels(hex);
    }
  }

  for (const [name, hex] of Object.entries(semantic)) {
    vars[`--himi-${name}`] = hexToChannels(hex);
  }

  for (const [name, value] of Object.entries(gradients)) {
    vars[`--himi-gradient-${name}`] = value;
  }

  for (const [name, value] of Object.entries(shadows)) {
    vars[`--himi-shadow-${name}`] = value;
  }

  for (const [name, value] of Object.entries(radii)) {
    vars[`--himi-radius-${name}`] = value;
  }

  for (const [name, value] of Object.entries(motion)) {
    vars[`--himi-${name === 'ease' ? 'ease' : `duration-${name}`}`] = value;
  }

  return vars;
}

/** Tailwind colour scale that reads the CSS variables, so opacity modifiers like `bg-blue-600/10` work. */
export function tailwindScale(family) {
  return Object.fromEntries(
    Object.keys(palette[family]).map((shade) => [shade, `rgb(var(--himi-${family}-${shade}) / <alpha-value>)`])
  );
}

export function tailwindSemantic() {
  return Object.fromEntries(
    Object.keys(semantic).map((name) => [name, `rgb(var(--himi-${name}) / <alpha-value>)`])
  );
}
