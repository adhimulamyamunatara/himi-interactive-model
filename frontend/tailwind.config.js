/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      boxShadow: {
        soft: '0 24px 60px rgba(15, 23, 42, 0.12)'
      },
      backgroundImage: {
        'mesh-gradient':
          'radial-gradient(circle at top left, rgba(37, 99, 235, 0.18), transparent 28%), radial-gradient(circle at top right, rgba(168, 85, 247, 0.14), transparent 24%), radial-gradient(circle at bottom center, rgba(34, 211, 238, 0.16), transparent 30%)'
      }
    }
  },
  plugins: []
};