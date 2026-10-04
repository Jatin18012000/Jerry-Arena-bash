/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the production build works from any static host or file path (offline-first).
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
    outDir: 'dist',
    // Three.js is large by nature; only warn well above its size.
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
