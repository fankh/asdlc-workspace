import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Deployable under a subpath (e.g. reverse-proxied at /agents/): set
  // VITE_BASE=/agents/ at build time. Defaults to root for local/dev.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
