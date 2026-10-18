/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
      },
      boxShadow: {
        soft: '0 24px 60px rgba(15, 23, 42, 0.12)',
        card: '0 10px 30px rgba(15, 23, 42, 0.06)',
        glow: '0 12px 40px rgba(37, 99, 235, 0.35)'
      },
      backgroundImage: {
        'mesh-gradient':
          'radial-gradient(circle at top left, rgba(37, 99, 235, 0.18), transparent 28%), radial-gradient(circle at top right, rgba(168, 85, 247, 0.14), transparent 24%), radial-gradient(circle at bottom center, rgba(34, 211, 238, 0.16), transparent 30%)',
        'brand-gradient': 'linear-gradient(135deg, #2563eb 0%, #7c3aed 55%, #06b6d4 100%)'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' }
        }
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite'
      }
    }
  },
  plugins: []
};
