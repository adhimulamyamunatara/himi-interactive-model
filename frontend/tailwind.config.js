import plugin from 'tailwindcss/plugin';
import {
  buildCssVariables,
  gradients,
  motion,
  radii,
  shadows,
  tailwindScale,
  tailwindSemantic
} from './src/styles/tokens.js';

/**
 * Brand colours come from `src/styles/tokens.js` (sampled from the HIMI logo). The CSS variables are
 * emitted into `:root` by the plugin below, and the Tailwind colour families read those variables.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        slate: tailwindScale('slate'),
        blue: tailwindScale('blue'),
        indigo: tailwindScale('indigo'),
        violet: tailwindScale('violet'),
        cyan: tailwindScale('cyan'),
        emerald: tailwindScale('emerald'),
        teal: tailwindScale('teal'),
        ...tailwindSemantic()
      },
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
        soft: shadows.soft,
        card: shadows.card,
        glow: shadows.glow,
        'glow-soft': shadows['glow-soft']
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
      addBase({ ':root': buildCssVariables() });
    })
  ]
};
