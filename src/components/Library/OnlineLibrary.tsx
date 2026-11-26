import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  BookOpen,
  Download,
  Loader2,
  Globe,
  Sparkles,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useLibraryStore } from '../../store/libraryStore'
import type { BookFormat } from '../../utils/fileDetection'
import clsx from 'clsx'

interface GutendexAuthor {
  name: string
  birth_year?: number
  death_year?: number
}

interface GutendexBook {
  id: number
  title: string
  authors: GutendexAuthor[]
  subjects: string[]
  languages: string[]
  download_count: number
  formats: Record<string, string>
}

interface GutendexResponse {
  count: number
  next: string | null
  previous: string | null
  results: GutendexBook[]
}

const TOPICS = [
  { id: '', label: 'Popular Classics' },
  { id: 'fiction', label: 'Fiction' },
  { id: 'science fiction', label: 'Sci-Fi' },
  { id: 'philosophy', label: 'Philosophy' },
  { id: 'mystery', label: 'Mystery' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'history', label: 'History' },
  { id: 'poetry', label: 'Poetry' },
]

function pickBestFormat(formats: Record<string, string>): {
  url: string
  format: BookFormat
  mime: string
} | null {
  const epub = formats['application/epub+zip']
  if (epub) return { url: epub, format: 'epub', mime: 'application/epub+zip' }

  const txtUtf8 = formats['text/plain; charset=utf-8']
  if (txtUtf8) return { url: txtUtf8, format: 'txt', mime: 'text/plain' }

  const txt = formats['text/plain; charset=us-ascii'] || formats['text/plain']
  if (txt) return { url: txt, format: 'txt', mime: 'text/plain' }

  const html = formats['text/html'] || formats['text/html; charset=utf-8']
  if (html) return { url: html, format: 'html', mime: 'text/html' }

  return null
}

async function fetchBookBlob(targetUrl: string): Promise<Blob> {
  // Prefer our Cloudflare Worker proxy so Gutenberg CORS headers never block downloads
  const proxyUrl = `/api/gutenberg?url=${encodeURIComponent(targetUrl)}`
  try {
    const res = await fetch(proxyUrl)
    if (res.ok) {
      const contentType = res.headers.get('content-type') || ''
      // Avoid Vite dev SPA fallback returning index.html
      if (!contentType.includes('text/html') || targetUrl.endsWith('.htm') || targetUrl.endsWith('.html')) {
        return await res.blob()
      }
    }
  } catch {
    // Fallback to direct fetch
  }

  const direct = await fetch(targetUrl)
  if (!direct.ok) {
    throw new Error(`Download failed (${direct.status})`)
  }
  return await direct.blob()
}

export default function OnlineLibrary() {
  const navigate = useNavigate()
  const { books, addBook } = useLibraryStore()

  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [topic, setTopic] = useState('')
  const [page, setPage] = useState(1)
  const [results, setResults] = useState<GutendexBook[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrev, setHasPrev] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const fetchCatalog = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      if (submittedQuery.trim()) params.set('search', submittedQuery.trim())
      if (topic) params.set('topic', topic)

      const res = await fetch(`https://gutendex.com/books?${params.toString()}`)
      if (!res.ok) throw new Error(`Catalog error (${res.status})`)
      const data: GutendexResponse = await res.json()

      setResults(data.results || [])
      setTotalCount(data.count || 0)
      setHasNext(Boolean(data.next))
      setHasPrev(Boolean(data.previous))
    } catch {
      setError('Could not load the Project Gutenberg catalog. Please check your connection and retry.')
    } finally {
      setLoading(false)
    }
  }, [page, submittedQuery, topic])

  useEffect(() => {
    void fetchCatalog()
  }, [fetchCatalog])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSubmittedQuery(query)
  }

  const handleOpenBook = async (gBook: GutendexBook) => {
    const bookId = `gutenberg-${gBook.id}`
    const existing = books.find((b) => b.id === bookId)
    if (existing) {
      navigate(`/read/${bookId}`)
      return
    }

    const picked = pickBestFormat(gBook.formats)
    if (!picked) {
      setError(`"${gBook.title}" has no readable EPUB/TXT/HTML format available.`)
      return
    }

    setDownloadingId(gBook.id)
    setError(null)
    try {
      const blob = await fetchBookBlob(picked.url)
      const safeName = gBook.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 80)
      const file = new File([blob], `${safeName}.${picked.format}`, { type: picked.mime })
      const author = gBook.authors?.[0]?.name?.replace(/,\s*/g, ' ').trim()

      addBook({
        id: bookId,
        name: gBook.title,
        author,
        format: picked.format,
        size: blob.size,
        file,
        addedAt: Date.now(),
        progress: 0,
        currentPage: 1,
        totalPages: 0,
        coverUrl: gBook.formats['image/jpeg'],
      })

      navigate(`/read/${bookId}`)
    } catch (err) {
      setError(
        err instanceof Error
          ? `Failed to download "${gBook.title}": ${err.message}`
          : `Failed to download "${gBook.title}".`
      )
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-6 select-none">
      {/* Banner & Search */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-amber-950/35 via-gray-900 to-gray-950 border border-amber-500/20 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Globe className="w-4 h-4" /> Project Gutenberg · Gutendex
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-white">
              70,000+ Free Classic Books
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Search any title or author and open it directly in the Apple Books viewer — saved offline automatically.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-96">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title or author (e.g. Sherlock)…"
                className="w-full bg-gray-950/80 border border-gray-700/80 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button type="submit" className="btn-primary py-2 px-4 text-sm shrink-0">
              Search
            </button>
          </form>
        </div>

        {/* Topic Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {TOPICS.map((t) => (
            <button
              key={t.id || 'all'}
              onClick={() => {
                setTopic(t.id)
                setPage(1)
              }}
              className={clsx(
                'px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border',
                topic === t.id
                  ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                  : 'bg-gray-900/80 text-gray-300 border-gray-800 hover:border-amber-500/40 hover:text-white'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={() => void fetchCatalog()}
            className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-amber-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm text-gray-400">Browsing Project Gutenberg library…</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-amber-500/40" />
          <p className="text-base font-medium text-white">No matching books found</p>
          <p className="text-xs text-gray-500 mt-1">Try another title, author, or genre.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-gray-400 px-1">
            <span>
              Showing {results.length} of {totalCount.toLocaleString()} free books
            </span>
            <span>Page {page}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 sm:gap-6">
            {results.map((gBook) => {
              const cover = gBook.formats['image/jpeg']
              const author = gBook.authors?.[0]?.name || 'Unknown Author'
              const picked = pickBestFormat(gBook.formats)
              const isSaved = books.some((b) => b.id === `gutenberg-${gBook.id}`)
              const isDownloading = downloadingId === gBook.id

              return (
                <div
                  key={gBook.id}
                  onClick={() => !isDownloading && void handleOpenBook(gBook)}
                  className="group flex flex-col cursor-pointer"
                >
                  <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-xl group-hover:shadow-2xl group-hover:shadow-amber-500/10 transition-all duration-300 group-hover:-translate-y-1.5 border border-white/10 bg-gradient-to-br from-stone-800 via-stone-900 to-black">
                    {cover ? (
                      <img
                        src={cover}
                        alt={gBook.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                        <BookOpen className="w-10 h-10 text-amber-400/40 mb-2" />
                        <span className="text-xs font-serif text-white line-clamp-3">
                          {gBook.title}
                        </span>
                      </div>
                    )}

                    {/* Spine shadow overlay */}
                    <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/50 via-black/20 to-transparent pointer-events-none" />

                    {/* Format / Saved badge */}
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      {picked && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-black/75 text-amber-300 border border-amber-500/30 backdrop-blur-md">
                          {picked.format}
                        </span>
                      )}
                    </div>

                    {isSaved && (
                      <span className="absolute top-2 right-2 p-1 rounded-full bg-emerald-500 text-white shadow-md" title="Saved on device">
                        <Check className="w-3 h-3" />
                      </span>
                    )}

                    {/* Hover / Downloading overlay */}
                    <div
                      className={clsx(
                        'absolute inset-0 bg-black/65 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 transition-opacity p-3 text-center',
                        isDownloading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      )}
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
                          <span className="text-xs font-medium text-white">Opening book…</span>
                        </>
                      ) : (
                        <>
                          <div className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                            {isSaved ? <BookOpen className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                            <span>{isSaved ? 'Read Now' : 'Open Book'}</span>
                          </div>
                          <span className="text-[10px] text-gray-300">
                            {gBook.download_count.toLocaleString()} reads
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 px-1">
                    <h4 className="text-white text-sm font-medium leading-snug line-clamp-1 group-hover:text-amber-400 transition-colors">
                      {gBook.title}
                    </h4>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{author}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!hasPrev || loading}
              className="btn-ghost border border-gray-800 disabled:opacity-30 text-sm"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-xs font-mono text-gray-400 px-2">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNext || loading}
              className="btn-ghost border border-gray-800 disabled:opacity-30 text-sm"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
