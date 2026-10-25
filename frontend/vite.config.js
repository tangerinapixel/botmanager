import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5005',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5005',
        changeOrigin: true,
      },
      '/exportar-etiqueta': {
        target: 'http://localhost:5005',
        changeOrigin: true,
      },
      '/exportar-grupo': {
        target: 'http://localhost:5005',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5005',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
  },
});
