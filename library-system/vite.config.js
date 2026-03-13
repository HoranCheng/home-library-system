import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  test: {
    exclude: ['**/node_modules/**', '**/e2e/**', '**/dist/**'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html'),
    },
  },
  server: {
    port: 3000,
    open: '/src/index.html',
  },
});
