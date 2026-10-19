import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves a project site under /<repo>/, so the deploy workflow sets VITE_BASE_PATH. Locally it is "/".
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    host: '0.0.0.0'
  }
});