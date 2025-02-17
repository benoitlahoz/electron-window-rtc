import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import vue from '@vitejs/plugin-vue';
import svgLoader from 'vite-svg-loader';
// import vueDevTools from 'vite-plugin-vue-devtools';
import autoprefixer from 'autoprefixer';
// @ts-ignore Module resolution.
import tailwind from 'tailwindcss';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@/renderer': resolve('src/renderer/src'),
        '@/components': resolve('src/renderer/src/components'),
      },
    },
    css: {
      postcss: {
        plugins: [tailwind(), autoprefixer()],
      },
    },
    // @ts-ignore Unknown error.
    plugins: [vue(), svgLoader() /*, vueDevTools() */],
  },
});
