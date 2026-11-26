import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const ALLOWED_HOSTS = new Set([
  'www.gutenberg.org',
  'gutenberg.org',
  'gutendex.com',
  'www.gutendex.com',
  'openlibrary.org',
  'www.openlibrary.org',
  'covers.openlibrary.org',
  'archive.org',
  'www.archive.org',
  'en.wikisource.org',
  'ws-export.wmcloud.org',
])

function isAllowedHost(hostname: string): boolean {
  return (
    ALLOWED_HOSTS.has(hostname) ||
    hostname.endsWith('.archive.org') ||
    hostname.endsWith('.gutenberg.org')
  )
}

function devBookProxyPlugin(): Plugin {
  return {
    name: 'dev-book-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/proxy') && !req.url?.startsWith('/api/gutenberg')) {
          return next()
        }

        try {
          const parsed = new URL(req.url, 'http://localhost')
          const target = parsed.searchParams.get('url')
          if (!target) {
            res.statusCode = 400
            res.end('Missing url parameter')
            return
          }

          const targetUrl = new URL(target)
          if (targetUrl.protocol !== 'https:' || !isAllowedHost(targetUrl.hostname)) {
            res.statusCode = 403
            res.end(`Host not allowed: ${targetUrl.hostname}`)
            return
          }

          const upstream = await fetch(targetUrl.toString(), {
            redirect: 'follow',
            signal: AbortSignal.timeout(25000),
            headers: {
              'User-Agent': 'BookShelf-Reader/1.0',
            },
          })

          res.statusCode = upstream.status
          const ct = upstream.headers.get('content-type')
          if (ct) res.setHeader('Content-Type', ct)
          res.setHeader('Access-Control-Allow-Origin', '*')

          const buf = Buffer.from(await upstream.arrayBuffer())
          res.end(buf)
        } catch (err) {
          res.statusCode = 502
          res.end(err instanceof Error ? err.message : 'Proxy error')
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), devBookProxyPlugin()],
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          pdf: ['pdfjs-dist'],
          epub: ['epubjs'],
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
})
