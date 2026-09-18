import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Dev middleware for the admin API (scripts/admin-api.mjs).
 * Handles /api/* in-process during `vite dev` so the app stays single-origin;
 * imports the server module only when an /api request arrives.
 */
function adminApi(): Plugin {
  return {
    name: 'admin-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()
        try {
          const { createAdminApiServer } = await import('./scripts/admin-api.mjs')
          const api = createAdminApiServer()
          // Delegate to the same handler used by the standalone server
          api.emit('request', req, res)
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(err) }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), adminApi()],
  // Absolute base: required for SPA deep-link refreshes. With the previous
  // relative base ('./'), refreshing /title/<id> resolved ./assets/* against
  // /title/ → /title/assets/*, which no server fallback can serve correctly.
  // If deploying under a subpath, use e.g. base: '/mikflix/' instead.
  base: '/',
  server: {
    port: Number(process.env.APP_PORT) || 5173,
  },
})
