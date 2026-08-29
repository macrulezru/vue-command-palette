import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ['src/**/*'],
      exclude: ['src/nuxt/runtime/**'],
      outDir: 'dist',
    }),
  ],
  build: {
    lib: {
      entry: {
        'vue-command-palette': resolve(__dirname, 'src/index.ts'),
        testing: resolve(__dirname, 'src/testing.ts'),
        'nuxt/module': resolve(__dirname, 'src/nuxt/module.ts'),
        'nuxt/runtime/plugin': resolve(__dirname, 'src/nuxt/runtime/plugin.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => (format === 'es' ? `${entryName}.js` : `${entryName}.cjs`),
    },
    rollupOptions: {
      external: ['vue', '@nuxt/kit', '#imports'],
      output: {
        globals: { vue: 'Vue' },
        exports: 'named',
      },
    },
    minify: 'esbuild',
    target: 'es2020',
  },
})
