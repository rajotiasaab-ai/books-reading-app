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
  Library,
  Archive,
  ScrollText,
  RefreshCw,
} from 'lucide-react'
import { useLibraryStore } from '../../store/libraryStore'
import {
  searchOnlineCatalog,
  downloadOnlineBook,
  type ApiSourceId,
  type OnlineBookItem,
} from '../../utils/onlineApis'
import clsx from 'clsx'

const API_SOURCES: {
  id: ApiSourceId
  name: string
  badge: string
  description: string
  icon: React.ReactNode
}[] = [
  {
    id: 'gutenberg',
    name: 'Project Gutenberg',
    badge: '70k+ EPUBs',
    description: 'Classic literature & novels via Gutendex API',
    icon: <BookOpen className="w-4 h-4" />,
  },
  {
    id: 'archive',
    name: 'Internet Archive',
    badge: 'PDF & EPUB',
    description: 'Millions of open public-domain PDFs & EPUB books',
    icon: <Archive className="w-4 h-4" />,
  },
  {
    id: 'openlibrary',
    name: 'Open Library',
    badge: 'Full-Text',
    description: 'Public full-text editions with rich cover metadata',
    icon: <Library className="w-4 h-4" />,
  },
  {
    id: 'wikisource',
    name: 'Wikisource',
    badge: 'EPUB Export',
    description: 'Free poetry, plays, essays & historical texts',
    icon: <ScrollText className="w-4 h-4" />,
  },
]

const TOPICS = [
  { id: '', label: 'Popular' },
  { id: 'fiction', label: 'Fiction' },
  { id: 'science fiction', label: 'Sci-Fi' },
  { id: 'philosophy', label: 'Philosophy' },
  { id: 'mystery', label: 'Mystery' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'history', label: 'History' },
  { id: 'poetry', label: 'Poetry' },
]

export default function OnlineLibrary() {
  const navigate = useNavigate()
  const { books, addBook, loadFile } = useLibraryStore()

  const [source, setSource] = useState<ApiSourceId>('gutenberg')
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [topic, setTopic] = useState('')
  const [page, setPage] = useState(1)

  const [results, setResults] = useState<OnlineBookItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrev, setHasPrev] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingUid, setDownloadingUid] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  const activeSourceInfo = API_SOURCES.find((s) => s.id === source)!

  const fetchCatalog = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true)
      setError(null)
      try {
        const res = await searchOnlineCatalog(source, submittedQuery, topic, page, signal)
        if (signal.aborted) return
        setResults(res.items)
        setTotalCount(res.totalCount)
        setHasNext(res.hasNext)
        setHasPrev(res.hasPrev)
      } catch (err) {
        if (signal.aborted) return
        const msg =
          err instanceof Error && err.name === 'AbortError'
            ? `${activeSourceInfo.name} timed out after 12s. Try switching to another API tab above or click Retry.`
            : `Could not reach ${activeSourceInfo.name}. Try switching API tabs above or click Retry.`
        setError(msg)
        setResults([])
      } finally {
        if (!signal.aborted) {
          setLoading(false)
        }
      }
    },
    [source, submittedQuery, topic, page, activeSourceInfo.name, reloadNonce]
  )

  useEffect(() => {
    const controller = new AbortController()
    void fetchCatalog(controller.signal)
    return () => controller.abort()
  }, [fetchCatalog])

  const handleSourceSwitch = (nextSource: ApiSourceId) => {
    setSource(nextSource)
    setPage(1)
    setError(null)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSubmittedQuery(query)
  }

  const triggerBrowserDownload = (file: File) => {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const ensureBookDownloaded = async (item: OnlineBookItem): Promise<File> => {
    const existing = books.find((b) => b.id === item.uid)
    if (existing) {
      const existingFile = await loadFile(item.uid)
      if (existingFile) return existingFile
    }

    const downloaded = await downloadOnlineBook(item)
    addBook({
      id: item.uid,
      name: item.title,
      author: downloaded.author || item.author,
      format: downloaded.format,
      size: downloaded.file.size,
      file: downloaded.file,
      addedAt: Date.now(),
      progress: 0,
      currentPage: 1,
      totalPages: 0,
      coverUrl: downloaded.coverUrl || item.coverUrl,
    })
    return downloaded.file
  }

  const handleOpenBook = async (item: OnlineBookItem) => {
    setDownloadingUid(item.uid)
    setError(null)
    try {
      await ensureBookDownloaded(item)
      navigate(`/read/${item.uid}`)
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not open "${item.title}": ${err.message}`
          : `Could not open "${item.title}".`
      )
    } finally {
      setDownloadingUid(null)
    }
  }

  const handleSaveToDevice = async (e: React.MouseEvent, item: OnlineBookItem) => {
    e.stopPropagation()
    setDownloadingUid(item.uid)
    setError(null)
    try {
      const file = await ensureBookDownloaded(item)
      triggerBrowserDownload(file)
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not download "${item.title}": ${err.message}`
          : `Could not download "${item.title}".`
      )
    } finally {
      setDownloadingUid(null)
    }
  }

  return (
    <div className="space-y-6 select-none">
      {/* Separate API Source Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {API_SOURCES.map((api) => {
          const active = source === api.id
          return (
            <button
              key={api.id}
              onClick={() => handleSourceSwitch(api.id)}
              className={clsx(
                'flex flex-col items-start text-left p-3.5 rounded-2xl border transition-all',
                active
                  ? 'bg-amber-600/20 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                  : 'bg-gray-900/70 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
              )}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <span className={clsx('p-1.5 rounded-lg', active ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-amber-400')}>
                  {api.icon}
                </span>
                <span
                  className={clsx(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                    active
                      ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                      : 'bg-gray-800 text-gray-400'
                  )}
                >
                  {api.badge}
                </span>
              </div>
              <span className="text-sm font-semibold text-white">{api.name}</span>
              <span className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">
                {api.description}
              </span>
            </button>
          )
        })}
      </div>

      {/* Active API Banner & Search */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-amber-950/35 via-gray-900 to-gray-950 border border-amber-500/20 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Globe className="w-4 h-4" /> {activeSourceInfo.name} · {activeSourceInfo.badge}
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-white">
              Browse & Read Free Online Books
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              {activeSourceInfo.description}. Tap any book to download into your bookshelf and open immediately.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-96">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${activeSourceInfo.name}…`}
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
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={() => setReloadNonce((n) => n + 1)}
            className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-medium flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-amber-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm text-gray-400">Loading {activeSourceInfo.name}…</p>
        </div>
      ) : results.length === 0 && !error ? (
        <div className="text-center py-16 text-gray-400">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-amber-500/40" />
          <p className="text-base font-medium text-white">No matching books found</p>
          <p className="text-xs text-gray-500 mt-1">
            Try another keyword, genre, or switch to another API tab above.
          </p>
        </div>
      ) : results.length > 0 ? (
        <>
          <div className="flex items-center justify-between text-xs text-gray-400 px-1">
            <span>
              Showing {results.length} of {totalCount.toLocaleString()} results in {activeSourceInfo.name}
            </span>
            <span>Page {page}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 sm:gap-6">
            {results.map((item) => {
              const isSaved = books.some((b) => b.id === item.uid)
              const isDownloading = downloadingUid === item.uid

              return (
                <div
                  key={item.uid}
                  onClick={() => !isDownloading && void handleOpenBook(item)}
                  className="group flex flex-col cursor-pointer"
                >
                  <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-xl group-hover:shadow-2xl group-hover:shadow-amber-500/10 transition-all duration-300 group-hover:-translate-y-1.5 border border-white/10 bg-gradient-to-br from-stone-800 via-stone-900 to-black">
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                        <BookOpen className="w-10 h-10 text-amber-400/40 mb-2" />
                        <span className="text-xs font-serif text-white line-clamp-3">
                          {item.title}
                        </span>
                      </div>
                    )}

                    {/* Spine shadow overlay */}
                    <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/50 via-black/20 to-transparent pointer-events-none" />

                    {/* Format & Saved badge */}
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-black/75 text-amber-300 border border-amber-500/30 backdrop-blur-md">
                        {item.formatHint}
                      </span>
                    </div>

                    {isSaved && (
                      <span
                        className="absolute top-2 right-2 p-1 rounded-full bg-emerald-500 text-white shadow-md"
                        title="Saved on device"
                      >
                        <Check className="w-3 h-3" />
                      </span>
                    )}

                    {/* Hover / Downloading overlay */}
                    <div
                      className={clsx(
                        'absolute inset-0 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 transition-opacity p-3 text-center',
                        isDownloading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      )}
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
                          <span className="text-xs font-medium text-white">Fetching book…</span>
                        </>
                      ) : (
                        <>
                          <div className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{isSaved ? 'Read Now' : 'Open Book'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => void handleSaveToDevice(e, item)}
                            className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-medium flex items-center gap-1 border border-white/15"
                            title="Save file to device"
                          >
                            <Download className="w-3 h-3" />
                            <span>Save File</span>
                          </button>
                          {item.subtitle && (
                            <span className="text-[10px] text-gray-300">{item.subtitle}</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 px-1">
                    <h4 className="text-white text-sm font-medium leading-snug line-clamp-1 group-hover:text-amber-400 transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{item.author}</p>
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
      ) : null}
    </div>
  )
}
