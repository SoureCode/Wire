import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'assets/wire.js',
      name: 'Wire',
      fileName: 'wire',
      formats: ['es', 'iife'],
    },
    outDir: 'dist',
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
})
