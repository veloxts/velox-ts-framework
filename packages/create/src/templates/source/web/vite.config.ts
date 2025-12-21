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
  // Define process.env for browser compatibility
  // Some dependencies (like dotenv config check) reference process.env
  // even when not actually used at runtime
  define: {
    'process.env': {},
  },
  // Exclude native Node.js modules from dependency optimization
  optimizeDeps: {
    exclude: ['bcrypt', '@mapbox/node-pre-gyp', 'dotenv'],
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
