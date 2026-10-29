import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(__dirname, 'src/web'),
  base: process.env.WEB_BASE ?? '/',
  publicDir: resolve(__dirname, 'resources/web'),
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src'),
    },
  },
  build: { outDir: resolve(__dirname, 'dist-web'), emptyOutDir: true, manifest: false, target: 'es2022' },
  server: { host: 'localhost', fs: { allow: [__dirname] } },
});
