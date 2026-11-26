interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>
  }
}

const EXACT_ALLOWED_HOSTS = new Set([
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
  if (EXACT_ALLOWED_HOSTS.has(hostname)) return true
  if (hostname.endsWith('.archive.org')) return true
  if (hostname.endsWith('.gutenberg.org')) return true
  return false
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/proxy' || url.pathname === '/api/gutenberg') {
      const target = url.searchParams.get('url')
      if (!target) {
        return new Response('Missing url parameter', { status: 400 })
      }

      let targetUrl: URL
      try {
        targetUrl = new URL(target)
      } catch {
        return new Response('Invalid url parameter', { status: 400 })
      }

      if (targetUrl.protocol !== 'https:' || !isAllowedHost(targetUrl.hostname)) {
        return new Response(`Host not allowed: ${targetUrl.hostname}`, { status: 403 })
      }

      try {
        const upstream = await fetch(targetUrl.toString(), {
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
          headers: {
            'User-Agent': 'BookShelf-Reader/1.0 (https://github.com/rajotiasaab-ai/books-reading-app)',
          },
        })

        if (!upstream.ok) {
          return new Response(`Upstream error: ${upstream.status}`, { status: upstream.status })
        }

        const headers = new Headers(upstream.headers)
        headers.set('Access-Control-Allow-Origin', '*')
        headers.set('Cache-Control', 'public, max-age=3600')

        return new Response(upstream.body, {
          status: upstream.status,
          headers,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upstream fetch failed'
        return new Response(`Proxy error: ${message}`, { status: 504 })
      }
    }

    return env.ASSETS.fetch(request)
  },
}
