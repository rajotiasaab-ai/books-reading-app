interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>
  }
}

const ALLOWED_HOSTS = new Set([
  'www.gutenberg.org',
  'gutenberg.org',
  'gutendex.com',
  'www.gutendex.com',
])

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/gutenberg') {
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

      if (targetUrl.protocol !== 'https:' || !ALLOWED_HOSTS.has(targetUrl.hostname)) {
        return new Response('Host not allowed', { status: 403 })
      }

      const upstream = await fetch(targetUrl.toString(), {
        redirect: 'follow',
        headers: {
          'User-Agent': 'BookShelf-Reader/1.0',
        },
      })

      if (!upstream.ok) {
        return new Response(`Upstream error: ${upstream.status}`, { status: upstream.status })
      }

      const headers = new Headers(upstream.headers)
      headers.set('Access-Control-Allow-Origin', '*')
      headers.set('Cache-Control', 'public, max-age=86400')

      return new Response(upstream.body, {
        status: upstream.status,
        headers,
      })
    }

    return env.ASSETS.fetch(request)
  },
}
