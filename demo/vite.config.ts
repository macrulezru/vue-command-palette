import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      {
        find: 'vue-command-palette/style.css',
        replacement: fileURLToPath(new URL('../src/style.css', import.meta.url)),
      },
      {
        find: 'vue-command-palette',
        replacement: fileURLToPath(new URL('../src/index.ts', import.meta.url)),
      },
    ],
  },
})
