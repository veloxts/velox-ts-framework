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
  server: {
    port: __WEB_PORT__,
    proxy: {
      /* @if trpc */
      '/trpc': {
        target: 'http://localhost:__API_PORT__',
        changeOrigin: true,
      },
      /* @endif trpc */
      /* @if default */
      '/api': {
        target: 'http://localhost:__API_PORT__',
        changeOrigin: true,
      },
      /* @endif default */
      /* @if auth */
      '/api': {
        target: 'http://localhost:__API_PORT__',
        changeOrigin: true,
      },
      /* @endif auth */
    },
  },
});
