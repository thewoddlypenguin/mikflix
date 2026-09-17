import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Absolute base: required for SPA deep-link refreshes. With the previous
  // relative base ('./'), refreshing /title/<id> resolved ./assets/* against
  // /title/ → /title/assets/*, which no server fallback can serve correctly.
  // If deploying under a subpath, use e.g. base: '/mikflix/' instead.
  base: '/',
  server: {
    port: Number(process.env.APP_PORT) || 5173,
  },
})