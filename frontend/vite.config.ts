import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/summarise': 'https://echoread-api-693200397320.europe-west2.run.app',
      '/speak': 'https://echoread-api-693200397320.europe-west2.run.app',
      '/voices': 'https://echoread-api-693200397320.europe-west2.run.app',
      '/history': 'https://echoread-api-693200397320.europe-west2.run.app',
    },
  },
})
