import { defineConfig } from 'vite'

export default defineConfig({
  base: '/image-enhacer/',
  
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
})
