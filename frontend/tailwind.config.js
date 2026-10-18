import plugin from 'tailwindcss/plugin';
import {
  buildCssVariables,
  buildSolidVariables,
  FAMILIES,
  gradients,
  motion,
  radii,
  tailwindScale,
  tailwindSemantic,
  tailwindSolidScale
} from './src/styles/tokens.js';

const SURFACE = 'rgb(var(--himi-surface) / <alpha-value>)';
const solidScales = Object.fromEntries(FAMILIES.map((family) => [family, tailwindSolidScale(family)]));

/**
 * Brand colours come from `src/styles/tokens.js` (sampled from the HIMI logo). The CSS variables are
 * emitted into `:root` by the plugin below, and the Tailwind colour families read those variables.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  // The theme lives on <html data-theme="light|dark">, set before first paint (see index.html) and by useTheme.
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ...Object.fromEntries(FAMILIES.map((family) => [family, tailwindScale(family)])),
        ...tailwindSemantic(),
        // Always white, in both themes (switch knobs, drawing paper). `bg-white` follows the theme instead.
        paper: '#ffffff'
      },
      // Backgrounds and gradient stops keep solid fills (buttons, bands) the same in both themes; only pale tints
      // follow the theme. `bg-white` means "the card surface", so it turns dark in the dark theme.
      backgroundColor: { ...solidScales, white: SURFACE },
      gradientColorStops: { ...solidScales, white: SURFACE },
      borderColor: { white: SURFACE },
      ringColor: { white: SURFACE },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        // Rounded geometric display face that echoes the HIMI wordmark.
        display: ['Nunito', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
      },
      borderRadius: {
        control: radii.control,
        card: radii.card,
        panel: radii.panel
      },
      boxShadow: {
        soft: 'var(--himi-shadow-soft)',
        card: 'var(--himi-shadow-card)',
        glow: 'var(--himi-shadow-glow)',
        'glow-soft': 'var(--himi-shadow-glow-soft)'
      },
      backgroundImage: {
        'mesh-gradient': gradients.mesh,
        'brand-gradient': gradients.brand,
        'spectrum-gradient': gradients.spectrum,
        'learn-gradient': gradients.learn
      },
      transitionDuration: {
        fast: motion.fast,
        base: motion.base,
        slow: motion.slow
      },
      transitionTimingFunction: {
        himi: motion.ease
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' }
        },
        'soft-pulse': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.06)' }
        }
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'soft-pulse': 'soft-pulse 2.4s ease-in-out infinite'
      }
    }
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': { ...buildCssVariables('light'), ...buildSolidVariables() },
        '[data-theme="dark"]': buildCssVariables('dark'),
        // Restores the light values inside a subtree (dark bands, code blocks, diagram paper) in either theme.
        '.force-light': buildCssVariables('light')
      });
    })
  ]
};
