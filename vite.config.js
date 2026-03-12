import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',  // Change from '/data-dictionary/' since we're self-hosting
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',  // Proxy to FastAPI in development
    }
  }
});