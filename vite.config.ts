import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Two entry points: the side panel page and the background service worker.
// The worker must sit at a fixed path because manifest.json names it.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // The panel loads from disk, so one large script costs nothing to fetch.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        sidepanel: 'sidepanel.html',
        background: 'src/background.ts',
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
})
