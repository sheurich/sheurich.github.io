import { defineConfig } from 'vite';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';

export default defineConfig({
  root: '.',
  build: { outDir: 'dist' },
  css: {
    postcss: { plugins: [tailwindcss(), autoprefixer()] }
  },
  server: { open: true, strictPort: true }
});
