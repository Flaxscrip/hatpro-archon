import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const port = Number(process.env.VITE_PORT ?? '4229');

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true, port, allowedHosts: true },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000, sourcemap: true },
});
