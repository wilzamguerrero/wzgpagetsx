
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // En desarrollo: `npm run dev` levanta Vite + `wrangler pages dev` (:8788).
    // Vite reenvía las llamadas /api a las Cloudflare Pages Functions locales,
    // así funcionan tanto la lectura de Notion como la subida de archivos.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    emptyOutDir: true,
  }
});
