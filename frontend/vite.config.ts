import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Explicit base path for Vercel
  optimizeDeps: {
    include: ['lucide-react'], // Include for better pre-bundling
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined, // Disable manual chunking to fix 404 issues
      },
    },
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    sourcemap: true, // Enable for debugging
    minify: 'esbuild', // Faster default minifier
  },
});
