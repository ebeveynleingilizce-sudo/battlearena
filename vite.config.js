import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.DEPLOY_BASE || '/',
  base: process.env.DEPLOY_BASE || '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
