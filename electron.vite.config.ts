import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

const alias = {
  '@shared': resolve(__dirname, 'src/shared'),
};

export default defineConfig({
  main: {
    resolve: { alias },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          // Runs in an Electron utilityProcess so CPU-heavy speech recognition never blocks the main process.
          speechHost: resolve(__dirname, 'src/main/speech/host/speechHost.ts'),
        },
      },
    },
  },
  preload: {
    resolve: { alias },
  },
  renderer: {
    resolve: {
      alias: {
        ...alias,
        '@renderer': resolve(__dirname, 'src/renderer/src'),
      },
    },
    plugins: [react()],
  },
});
