import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  root: './frontend',
  base: './',
  build: {
    outDir: './dist',
    emptyOutDir: true
  },
  plugins: [vue()]
});
