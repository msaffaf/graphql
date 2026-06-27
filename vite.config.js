import { defineConfig } from 'vite';

// Minimal Vite config. The project uses zero runtime dependencies — Vite is only
// used as a dev server / bundler. `index.html` is the single entry point.
export default defineConfig({
  root: '.',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
