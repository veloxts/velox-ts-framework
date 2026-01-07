import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  dts: false,
  sourcemap: true,
  // Don't bundle dependencies - let Node.js resolve them at runtime
  // This avoids issues with native modules and dynamic requires
  skipNodeModulesBundle: true,
});
