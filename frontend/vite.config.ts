import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/summarise': 'http://localhost:8000',
      '/speak': 'http://localhost:8000',
      '/voices': 'http://localhost:8000',
    },
  },
})
