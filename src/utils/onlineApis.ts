import type { BookFormat } from './fileDetection'

export type ApiSourceId = 'gutenberg' | 'archive' | 'openlibrary' | 'wikisource'

export interface OnlineBookItem {
  uid: string
  source: ApiSourceId
  title: string
  author: string
  coverUrl?: string
  formatHint: string
  subtitle?: string
  payload: Record<string, unknown>
}

export interface SearchPageResult {
  items: OnlineBookItem[]
  totalCount: number
  hasNext: boolean
  hasPrev: boolean
}

export interface DownloadedBook {
  file: File
  format: BookFormat
  coverUrl?: string
  author?: string
}

async function fetchViaProxy(
  targetUrl: string,
  signal?: AbortSignal,
  timeoutMs = 12000
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`
    const res = await fetch(proxyUrl, { signal: controller.signal })

    // If proxy route isn't available (404), fall back to direct fetch
    if (res.status === 404) {
      return await fetch(targetUrl, { signal: controller.signal })
    }
    return res
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

async function fetchJsonViaProxy<T>(
  targetUrl: string,
  signal?: AbortSignal,
  timeoutMs = 15000
): Promise<T> {
  const res = await fetchViaProxy(targetUrl, signal, timeoutMs)
  if (!res.ok) {
    throw new Error(`API returned ${res.status}`)
  }
  return (await res.json()) as T
}

function makeSafeFilename(title: string, ext: string): string {
  const clean = title.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80) || 'book'
  return `${clean}.${ext}`
}

// ============================================================================
// 1. PROJECT GUTENBERG (GUTENDEX)
// ============================================================================
interface GutendexBook {
  id: number
  title: string
  authors: { name: string }[]
  download_count: number
  formats: Record<string, string>
}

interface GutendexResponse {
  count: number
  next: string | null
  previous: string | null
  results: GutendexBook[]
}

function pickGutenbergFormat(formats: Record<string, string>): {
  url: string
  format: BookFormat
  mime: string
} | null {
  if (formats['application/epub+zip']) {
    return { url: formats['application/epub+zip'], format: 'epub', mime: 'application/epub+zip' }
  }
  if (formats['text/plain; charset=utf-8']) {
    return { url: formats['text/plain; charset=utf-8'], format: 'txt', mime: 'text/plain' }
  }
  const plain = formats['text/plain; charset=us-ascii'] || formats['text/plain']
  if (plain) return { url: plain, format: 'txt', mime: 'text/plain' }
  const html = formats['text/html'] || formats['text/html; charset=utf-8']
  if (html) return { url: html, format: 'html', mime: 'text/html' }
  return null
}

async function searchGutenberg(
  query: string,
  topic: string,
  page: number,
  signal?: AbortSignal
): Promise<SearchPageResult> {
  const params = new URLSearchParams({ page: String(page) })
  if (query.trim()) params.set('search', query.trim())
  if (topic) params.set('topic', topic)

  const data = await fetchJsonViaProxy<GutendexResponse>(
    `https://gutendex.com/books?${params.toString()}`,
    signal
  )

  return {
    items: (data.results || []).map((b) => {
      const picked = pickGutenbergFormat(b.formats || {})
      return {
        uid: `gutenberg-${b.id}`,
        source: 'gutenberg',
        title: b.title,
        author: b.authors?.[0]?.name?.replace(/,\s*/g, ' ').trim() || 'Unknown Author',
        coverUrl: b.formats?.['image/jpeg'],
        formatHint: picked?.format.toUpperCase() || 'EPUB',
        subtitle: `${(b.download_count || 0).toLocaleString()} reads`,
        payload: b as unknown as Record<string, unknown>,
      }
    }),
    totalCount: data.count || 0,
    hasNext: Boolean(data.next),
    hasPrev: Boolean(data.previous),
  }
}

async function downloadGutenbergById(id: string | number): Promise<DownloadedBook> {
  const data = await fetchJsonViaProxy<GutendexBook>(`https://gutendex.com/books/${id}`)
  const picked = pickGutenbergFormat(data.formats || {})
  if (!picked) throw new Error('No EPUB or TXT format available for this Gutenberg book.')

  const res = await fetchViaProxy(picked.url, undefined, 20000)
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  const blob = await res.blob()
  const author = data.authors?.[0]?.name?.replace(/,\s*/g, ' ').trim()

  return {
    file: new File([blob], makeSafeFilename(data.title, picked.format), { type: picked.mime }),
    format: picked.format,
    coverUrl: data.formats?.['image/jpeg'],
    author,
  }
}

// ============================================================================
// 2. INTERNET ARCHIVE (PUBLIC DOMAIN PDFs & EPUBs)
// ============================================================================
interface ArchiveDoc {
  identifier: string
  title?: string | string[]
  creator?: string | string[]
  downloads?: number
  year?: string
}

interface ArchiveSearchResponse {
  response: {
    numFound: number
    docs: ArchiveDoc[]
  }
}

interface ArchiveFileEntry {
  name: string
  format?: string
  size?: string
}

async function searchArchive(
  query: string,
  topic: string,
  page: number,
  signal?: AbortSignal
): Promise<SearchPageResult> {
  const parts = [
    'mediatype:texts',
    '(format:EPUB OR format:"Text PDF")',
    'NOT collection:inlibrary',
    'NOT collection:printdisabled',
  ]
  if (query.trim()) parts.push(`(${query.trim()})`)
  if (topic) parts.push(`subject:(${topic})`)

  const params = new URLSearchParams({
    q: parts.join(' AND '),
    wt: 'json',
    rows: '24',
    page: String(page),
    output: 'json',
  })
  params.append('fl[]', 'identifier')
  params.append('fl[]', 'title')
  params.append('fl[]', 'creator')
  params.append('fl[]', 'downloads')
  params.append('fl[]', 'year')
  params.append('sort[]', 'downloads desc')

  const data = await fetchJsonViaProxy<ArchiveSearchResponse>(
    `https://archive.org/advancedsearch.php?${params.toString()}`,
    signal
  )

  const docs = data.response?.docs || []
  const totalCount = data.response?.numFound || 0

  return {
    items: docs.map((d) => {
      const title = Array.isArray(d.title) ? d.title[0] : d.title || d.identifier
      const creator = Array.isArray(d.creator) ? d.creator[0] : d.creator || 'Internet Archive'
      return {
        uid: `archive-${d.identifier}`,
        source: 'archive',
        title,
        author: creator,
        coverUrl: `https://archive.org/services/img/${d.identifier}`,
        formatHint: 'PDF / EPUB',
        subtitle: d.downloads ? `${d.downloads.toLocaleString()} reads` : d.year,
        payload: { identifier: d.identifier, title, creator },
      }
    }),
    totalCount,
    hasNext: page * 24 < totalCount,
    hasPrev: page > 1,
  }
}

async function downloadArchiveItem(
  identifier: string,
  title: string,
  author?: string
): Promise<DownloadedBook> {
  const meta = await fetchJsonViaProxy<{ result?: ArchiveFileEntry[] }>(
    `https://archive.org/metadata/${encodeURIComponent(identifier)}/files`
  )
  const files = meta.result || []

  const maxBytes = 25 * 1024 * 1024 // keep downloads fast in browser
  const eligible = files.filter((f) => {
    const size = Number(f.size || 0)
    return size === 0 || size <= maxBytes
  })

  const epub = eligible.find((f) => f.name.toLowerCase().endsWith('.epub'))
  const pdf = eligible.find(
    (f) => f.name.toLowerCase().endsWith('.pdf') && !f.name.toLowerCase().includes('_encrypted')
  )
  const txt = eligible.find(
    (f) => f.name.toLowerCase().endsWith('.txt') && !f.name.toLowerCase().endsWith('_meta.txt')
  )

  const chosen = epub || pdf || txt
  if (!chosen) {
    throw new Error('No open EPUB, PDF, or TXT file under 25 MB found in this Archive item.')
  }

  const ext: BookFormat = epub ? 'epub' : pdf ? 'pdf' : 'txt'
  const mime =
    ext === 'epub' ? 'application/epub+zip' : ext === 'pdf' ? 'application/pdf' : 'text/plain'

  const fileUrl = `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(chosen.name)}`
  const res = await fetchViaProxy(fileUrl, undefined, 25000)
  if (!res.ok) throw new Error(`Archive download failed (${res.status})`)

  const blob = await res.blob()
  return {
    file: new File([blob], makeSafeFilename(title, ext), { type: mime }),
    format: ext,
    coverUrl: `https://archive.org/services/img/${identifier}`,
    author,
  }
}

// ============================================================================
// 3. OPEN LIBRARY (PUBLIC FULL-TEXT CATALOG)
// ============================================================================
interface OpenLibraryDoc {
  key: string
  title: string
  author_name?: string[]
  cover_i?: number
  first_publish_year?: number
  ia?: string[]
  id_project_gutenberg?: string[]
}

interface OpenLibraryResponse {
  numFound: number
  docs: OpenLibraryDoc[]
}

async function searchOpenLibrary(
  query: string,
  topic: string,
  page: number,
  signal?: AbortSignal
): Promise<SearchPageResult> {
  const q = [query.trim(), topic].filter(Boolean).join(' ') || 'classic'
  const params = new URLSearchParams({
    q,
    has_fulltext: 'true',
    ebook_access: 'public',
    fields: 'key,title,author_name,cover_i,first_publish_year,id_project_gutenberg,ia',
    limit: '16',
    page: String(page),
  })

  const data = await fetchJsonViaProxy<OpenLibraryResponse>(
    `https://openlibrary.org/search.json?${params.toString()}`,
    signal,
    22000
  )

  const docs = (data.docs || []).filter(
    (d) => (d.id_project_gutenberg && d.id_project_gutenberg.length > 0) || (d.ia && d.ia.length > 0)
  )

  return {
    items: docs.map((d) => ({
      uid: `openlibrary-${d.key.replace(/\//g, '_')}`,
      source: 'openlibrary',
      title: d.title,
      author: d.author_name?.[0] || 'Unknown Author',
      coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
      formatHint: d.id_project_gutenberg?.length ? 'EPUB' : 'PDF / EPUB',
      subtitle: d.first_publish_year ? `Published ${d.first_publish_year}` : 'Public Domain',
      payload: d as unknown as Record<string, unknown>,
    })),
    totalCount: data.numFound || docs.length,
    hasNext: page * 16 < (data.numFound || 0),
    hasPrev: page > 1,
  }
}

async function downloadOpenLibraryItem(doc: OpenLibraryDoc): Promise<DownloadedBook> {
  const coverUrl = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined
  const author = doc.author_name?.[0]

  if (doc.id_project_gutenberg?.length) {
    try {
      const book = await downloadGutenbergById(doc.id_project_gutenberg[0])
      return { ...book, coverUrl: coverUrl || book.coverUrl, author: author || book.author }
    } catch {
      // fall through to Internet Archive IDs
    }
  }

  for (const iaId of (doc.ia || []).slice(0, 3)) {
    try {
      const book = await downloadArchiveItem(iaId, doc.title, author)
      return { ...book, coverUrl: coverUrl || book.coverUrl }
    } catch {
      // try next edition
    }
  }

  throw new Error('Could not find an open EPUB/PDF file for this Open Library edition.')
}

// ============================================================================
// 4. WIKISOURCE (FREE PUBLIC DOMAIN BOOKS & POETRY AS EPUB)
// ============================================================================
interface WikisourceSearchItem {
  pageid: number
  title: string
  snippet: string
  wordcount: number
}

interface WikisourceResponse {
  query?: {
    searchinfo?: { totalhits: number }
    search?: WikisourceSearchItem[]
  }
}

async function searchWikisource(
  query: string,
  topic: string,
  page: number,
  signal?: AbortSignal
): Promise<SearchPageResult> {
  const q = query.trim() || topic || 'Shakespeare'
  const offset = (page - 1) * 24
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: q,
    srnamespace: '0',
    srlimit: '24',
    sroffset: String(offset),
    format: 'json',
  })

  const data = await fetchJsonViaProxy<WikisourceResponse>(
    `https://en.wikisource.org/w/api.php?${params.toString()}`,
    signal
  )

  const items = data.query?.search || []
  const totalCount = data.query?.searchinfo?.totalhits || items.length

  return {
    items: items.map((w) => ({
      uid: `wikisource-${w.pageid}`,
      source: 'wikisource',
      title: w.title,
      author: 'Wikisource Public Domain',
      formatHint: 'EPUB',
      subtitle: `${w.wordcount.toLocaleString()} words`,
      payload: w as unknown as Record<string, unknown>,
    })),
    totalCount,
    hasNext: offset + 24 < totalCount,
    hasPrev: page > 1,
  }
}

async function downloadWikisourceItem(item: WikisourceSearchItem): Promise<DownloadedBook> {
  const pageSlug = item.title.replace(/ /g, '_')
  const epubUrl = `https://ws-export.wmcloud.org/?lang=en&format=epub&page=${encodeURIComponent(pageSlug)}`

  try {
    const res = await fetchViaProxy(epubUrl, undefined, 20000)
    if (res.ok) {
      const blob = await res.blob()
      if (blob.size > 500) {
        return {
          file: new File([blob], makeSafeFilename(item.title, 'epub'), {
            type: 'application/epub+zip',
          }),
          format: 'epub',
          author: 'Wikisource',
        }
      }
    }
  } catch {
    // fallback to plain text extract below
  }

  const params = new URLSearchParams({
    action: 'query',
    titles: item.title,
    prop: 'extracts',
    explaintext: '1',
    format: 'json',
  })
  const extractData = await fetchJsonViaProxy<{
    query?: { pages?: Record<string, { extract?: string }> }
  }>(`https://en.wikisource.org/w/api.php?${params.toString()}`)

  const pages = extractData.query?.pages || {}
  const firstPage = Object.values(pages)[0]
  const text = firstPage?.extract?.trim()
  if (!text) {
    throw new Error('This Wikisource page has no downloadable text or EPUB content.')
  }

  const blob = new Blob([`${item.title}\n\n${text}`], { type: 'text/plain' })
  return {
    file: new File([blob], makeSafeFilename(item.title, 'txt'), { type: 'text/plain' }),
    format: 'txt',
    author: 'Wikisource',
  }
}

// ============================================================================
// UNIFIED PUBLIC EXPORTS
// ============================================================================
export async function searchOnlineCatalog(
  source: ApiSourceId,
  query: string,
  topic: string,
  page: number,
  signal?: AbortSignal
): Promise<SearchPageResult> {
  switch (source) {
    case 'gutenberg':
      return searchGutenberg(query, topic, page, signal)
    case 'archive':
      return searchArchive(query, topic, page, signal)
    case 'openlibrary':
      return searchOpenLibrary(query, topic, page, signal)
    case 'wikisource':
      return searchWikisource(query, topic, page, signal)
  }
}

export async function downloadOnlineBook(item: OnlineBookItem): Promise<DownloadedBook> {
  switch (item.source) {
    case 'gutenberg': {
      const b = item.payload as unknown as GutendexBook
      const picked = pickGutenbergFormat(b.formats || {})
      if (!picked) throw new Error('No readable format available for this book.')
      const res = await fetchViaProxy(picked.url, undefined, 20000)
      if (!res.ok) throw new Error(`Download failed (${res.status})`)
      const blob = await res.blob()
      return {
        file: new File([blob], makeSafeFilename(item.title, picked.format), { type: picked.mime }),
        format: picked.format,
        coverUrl: item.coverUrl,
        author: item.author,
      }
    }
    case 'archive': {
      const p = item.payload as { identifier: string; title: string; creator?: string }
      return downloadArchiveItem(p.identifier, p.title, p.creator)
    }
    case 'openlibrary':
      return downloadOpenLibraryItem(item.payload as unknown as OpenLibraryDoc)
    case 'wikisource':
      return downloadWikisourceItem(item.payload as unknown as WikisourceSearchItem)
  }
}
