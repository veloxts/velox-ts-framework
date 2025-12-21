import path from 'node:path';

import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tanstackRouter(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Exclude native Node.js modules from dependency optimization
  // These are server-only dependencies from the api package
  optimizeDeps: {
    exclude: ['bcrypt', '@mapbox/node-pre-gyp'],
  },
  server: {
    port: __WEB_PORT__,
    proxy: {
      '/api': {
        target: 'http://localhost:__API_PORT__',
        changeOrigin: true,
      },
    },
  },
});
