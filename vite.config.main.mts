import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main/index.ts'),
      fileName: 'electron-window-rtc-main',
      formats: ['es'],
    },
    emptyOutDir: false,
    rollupOptions: {
      external: ['electron'],
    },
  },
  plugins: [
    dts({
      exclude: ['example/**/*'],
    }),
  ],
});
