import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths: dist/ can be served from any folder or sub-path.
  base: './',
  plugins: [react()],
  server: {
    port: 4173,
    host: true
  }
});
