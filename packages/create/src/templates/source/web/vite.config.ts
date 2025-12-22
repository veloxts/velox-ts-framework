import path from 'node:path';

import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { veloxNodeStubs } from '@veloxts/router/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [veloxNodeStubs(), tanstackRouter(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
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
