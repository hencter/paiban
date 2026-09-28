import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 使用相对 base，保证静态部署在任意子路径下刷新都不会出现资源路径错误
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    host: true,
    port: 5173,
  },
})
