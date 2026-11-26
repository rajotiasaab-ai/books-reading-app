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
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`
    const res = await fetch(proxyUrl, { signal: controller.signal })
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

function encodeArchivePath(name: string): string {
  return name
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
}

async function tryFetchBookBinary(
  url: string,
  expectedFormat: BookFormat,
  timeoutMs = 15000
): Promise<Blob | null> {
  try {
    const res = await fetchViaProxy(url, undefined, timeoutMs)
    if (!res.ok) return null
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    // Reject HTML maintenance/error pages when expecting binary EPUB/PDF/TXT
    if (expectedFormat !== 'html' && ct.includes('text/html')) {
      return null
    }
    const blob = await res.blob()
    if (blob.size < 200) return null
    return blob
  } catch {
    return null
  }
}

// ============================================================================
// 1. PROJECT GUTENBERG (GUTENDEX + PGLAF MIRROR + ARCHIVE GUTENBERG FALLBACK)
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
  try {
    const params = new URLSearchParams({ page: String(page) })
    if (query.trim()) params.set('search', query.trim())
    if (topic) params.set('topic', topic)

    const data = await fetchJsonViaProxy<GutendexResponse>(
      `https://gutendex.com/books?${params.toString()}`,
      signal,
      12000
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
  } catch (err) {
    if (signal?.aborted) throw err
    // Fallback to Internet Archive's Project Gutenberg collection mirror if Gutendex is down
    return searchArchive(query, topic, page, signal, 'collection:gutenberg')
  }
}

async function downloadGutenbergMirrored(
  id: string | number,
  title: string,
  author?: string,
  coverUrl?: string,
  formats?: Record<string, string>
): Promise<DownloadedBook> {
  const numId = String(id).trim()

  // 1. Try Gutenberg PGLAF mirror + primary Gutenberg URLs (short timeout so fallback is fast)
  const candidates: { url: string; format: BookFormat; mime: string }[] = [
    {
      url: `https://gutenberg.pglaf.org/cache/epub/${numId}/pg${numId}-images-3.epub`,
      format: 'epub',
      mime: 'application/epub+zip',
    },
    {
      url: `https://gutenberg.pglaf.org/cache/epub/${numId}/pg${numId}-images.epub`,
      format: 'epub',
      mime: 'application/epub+zip',
    },
    {
      url: `https://gutenberg.pglaf.org/cache/epub/${numId}/pg${numId}.txt`,
      format: 'txt',
      mime: 'text/plain',
    },
  ]

  if (formats) {
    const picked = pickGutenbergFormat(formats)
    if (picked) {
      candidates.push(picked)
    }
  }

  for (const c of candidates) {
    const blob = await tryFetchBookBinary(c.url, c.format, 6000)
    if (blob) {
      return {
        file: new File([blob], makeSafeFilename(title, c.format), { type: c.mime }),
        format: c.format,
        coverUrl,
        author,
      }
    }
  }

  // 2. Reliable fallback: Internet Archive's Project Gutenberg mirror!
  const padded5 = numId.padStart(5, '0')
  const cleanTitle = title.split(/[;:(]/)[0].replace(/"/g, '').trim()
  const searchQueries = [
    `collection:gutenberg AND identifier:*${padded5}gut`,
    ...(cleanTitle ? [`collection:gutenberg AND title:"${cleanTitle}"`] : []),
  ]

  for (const q of searchQueries) {
    try {
      const params = new URLSearchParams({
        q,
        wt: 'json',
        rows: '3',
        output: 'json',
      })
      params.append('fl[]', 'identifier')
      params.append('fl[]', 'title')
      params.append('sort[]', 'downloads desc')

      const data = await fetchJsonViaProxy<ArchiveSearchResponse>(
        `https://archive.org/advancedsearch.php?${params.toString()}`,
        undefined,
        12000
      )
      for (const doc of data.response?.docs || []) {
        try {
          const book = await downloadArchiveItem(doc.identifier, title, author)
          return { ...book, coverUrl: coverUrl || book.coverUrl }
        } catch {
          // try next matching mirror item
        }
      }
    } catch {
      // try next search query
    }
  }

  throw new Error(
    'Project Gutenberg servers are temporarily in maintenance and no mirror edition matched this title.'
  )
}

async function downloadGutenbergById(id: string | number): Promise<DownloadedBook> {
  const data = await fetchJsonViaProxy<GutendexBook>(
    `https://gutendex.com/books/${id}`,
    undefined,
    10000
  )
  const author = data.authors?.[0]?.name?.replace(/,\s*/g, ' ').trim()
  return downloadGutenbergMirrored(
    data.id,
    data.title,
    author,
    data.formats?.['image/jpeg'],
    data.formats
  )
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
  source?: string
  format?: string
  size?: string
  private?: string
}

async function searchArchive(
  query: string,
  topic: string,
  page: number,
  signal?: AbortSignal,
  extraCollection?: string
): Promise<SearchPageResult> {
  const parts = [
    'mediatype:texts',
    '(format:EPUB OR format:"Text PDF")',
    'NOT collection:inlibrary',
    'NOT collection:printdisabled',
  ]
  if (extraCollection) parts.push(extraCollection)
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
        source: extraCollection === 'collection:gutenberg' ? 'gutenberg' : 'archive',
        title,
        author: creator,
        coverUrl: `https://archive.org/services/img/${d.identifier}`,
        formatHint: 'PDF / EPUB',
        subtitle: d.downloads ? `${d.downloads.toLocaleString()} reads` : d.year,
        payload: { identifier: d.identifier, title, creator, isArchiveMirror: true },
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
    `https://archive.org/metadata/${encodeURIComponent(identifier)}/files`,
    undefined,
    15000
  )
  const files = meta.result || []

  const maxBytes = 25 * 1024 * 1024
  const eligible = files.filter((f) => {
    if (f.private === 'true') return false
    const size = Number(f.size || 0)
    return size === 0 || size <= maxBytes
  })

  const isEpub = (f: ArchiveFileEntry) => f.name.toLowerCase().endsWith('.epub')
  const isPdf = (f: ArchiveFileEntry) =>
    f.name.toLowerCase().endsWith('.pdf') && !f.name.toLowerCase().includes('_encrypted')
  const isTxt = (f: ArchiveFileEntry) =>
    f.name.toLowerCase().endsWith('.txt') &&
    !f.name.toLowerCase().endsWith('_meta.txt') &&
    !f.name.toLowerCase().endsWith('_djvu.txt')

  // Build ordered list of candidates (prefer original clean files before OCR derivatives)
  const ordered: { entry: ArchiveFileEntry; format: BookFormat; mime: string }[] = []
  const pushUnique = (entry: ArchiveFileEntry | undefined, format: BookFormat, mime: string) => {
    if (entry && !ordered.some((o) => o.entry.name === entry.name)) {
      ordered.push({ entry, format, mime })
    }
  }

  pushUnique(
    eligible.find((f) => isEpub(f) && f.source === 'original'),
    'epub',
    'application/epub+zip'
  )
  pushUnique(
    eligible.find((f) => isPdf(f) && f.source === 'original'),
    'pdf',
    'application/pdf'
  )
  pushUnique(eligible.find(isEpub), 'epub', 'application/epub+zip')
  pushUnique(eligible.find(isPdf), 'pdf', 'application/pdf')
  pushUnique(eligible.find(isTxt), 'txt', 'text/plain')
  pushUnique(
    eligible.find((f) => f.name.toLowerCase().endsWith('_djvu.txt')),
    'txt',
    'text/plain'
  )

  if (ordered.length === 0) {
    throw new Error('No open EPUB, PDF, or TXT file under 25 MB found in this item.')
  }

  for (const candidate of ordered) {
    const fileUrl = `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeArchivePath(candidate.entry.name)}`
    const blob = await tryFetchBookBinary(fileUrl, candidate.format, 25000)
    if (blob) {
      return {
        file: new File([blob], makeSafeFilename(title, candidate.format), {
          type: candidate.mime,
        }),
        format: candidate.format,
        coverUrl: `https://archive.org/services/img/${identifier}`,
        author,
      }
    }
  }

  throw new Error('This Archive item is borrow-only or protected and cannot be downloaded directly.')
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
  lending_identifier_s?: string
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
    fields:
      'key,title,author_name,cover_i,first_publish_year,lending_identifier_s,id_project_gutenberg,ia',
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

  // 1. Try Gutenberg edition (with PGLAF + Archive mirror built in)
  if (doc.id_project_gutenberg?.length) {
    try {
      const book = await downloadGutenbergById(doc.id_project_gutenberg[0])
      return { ...book, coverUrl: coverUrl || book.coverUrl, author: author || book.author }
    } catch {
      // fall through to public IA scans
    }
  }

  // 2. Prioritize public Archive.org scans (preferring *gut / *goog / *uoft, skipping lending_identifier_s)
  const iaList = (doc.ia || []).filter((id) => id !== doc.lending_identifier_s)
  const sortedIa = [...iaList].sort((a, b) => {
    const score = (id: string) =>
      id.endsWith('gut') ? 0 : id.endsWith('goog') || id.endsWith('uoft') ? 1 : 2
    return score(a) - score(b)
  })

  for (const iaId of sortedIa.slice(0, 5)) {
    try {
      const book = await downloadArchiveItem(iaId, doc.title, author)
      return { ...book, coverUrl: coverUrl || book.coverUrl }
    } catch {
      // try next scan
    }
  }

  // 3. Final fallback: search Internet Archive directly by title
  const res = await searchArchive(doc.title, '', 1)
  for (const item of res.items.slice(0, 2)) {
    try {
      const p = item.payload as { identifier: string; title: string; creator?: string }
      const book = await downloadArchiveItem(p.identifier, doc.title, author || p.creator)
      return { ...book, coverUrl: coverUrl || book.coverUrl }
    } catch {
      // next
    }
  }

  throw new Error('Could not find an open-access EPUB/PDF scan for this Open Library book.')
}

// ============================================================================
// 4. WIKISOURCE (FREE PUBLIC DOMAIN BOOKS & POETRY AS EPUB / TXT)
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

  const epubBlob = await tryFetchBookBinary(epubUrl, 'epub', 20000)
  if (epubBlob) {
    return {
      file: new File([epubBlob], makeSafeFilename(item.title, 'epub'), {
        type: 'application/epub+zip',
      }),
      format: 'epub',
      author: 'Wikisource',
    }
  }

  // Fallback to clean text extract from Wikisource API
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
      if ((item.payload as { isArchiveMirror?: boolean }).isArchiveMirror) {
        const p = item.payload as { identifier: string; title: string; creator?: string }
        return downloadArchiveItem(p.identifier, p.title, p.creator)
      }
      const b = item.payload as unknown as GutendexBook
      return downloadGutenbergMirrored(
        b.id,
        item.title,
        item.author,
        item.coverUrl,
        b.formats || {}
      )
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
