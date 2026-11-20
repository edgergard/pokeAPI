import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the site under /pokeAPI/; `vite preview` must match the built output.
  base: command === 'build' || isPreview ? '/pokeAPI/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        // GSAP core + first-paint plugins change far less often than app code: own chunk, cached across
        // deploys. Draggable, Flip, ScrambleText and their utils stay out of it, so they ride the on-demand
        // chunk of shared/lib/gsap-interactive.ts instead of the critical path.
        manualChunks: (id) =>
          /[\\/]node_modules[\\/](gsap|@gsap)[\\/]/.test(id) &&
          !/[\\/]gsap[\\/](Draggable|Flip|ScrambleTextPlugin)\.js$|[\\/]gsap[\\/]utils[\\/]/.test(id)
            ? 'gsap'
            : undefined,
      },
    },
  },
  test: {
    environment: 'node',
  },
}));
