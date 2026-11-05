import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef, Suspense } from 'react'
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  Upload,
  Bookmark as BookmarkIcon,
  Search,
  Volume2,
  List,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react'
import { useLibraryStore } from '../../store/libraryStore'
import { useReaderStore } from '../../store/readerStore'
import ReaderSettings from '../UI/ReaderSettings'
import BookmarksModal from '../UI/BookmarksModal'
import SearchModal, { type SearchResult } from '../UI/SearchModal'
import TtsBar from '../UI/TtsBar'
import PDFRenderer from '../renderers/PDFRenderer'
import EPUBRenderer, { type TocItem } from '../renderers/EPUBRenderer'
import TXTRenderer from '../renderers/TXTRenderer'
import clsx from 'clsx'

export default function Viewer() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const { books, getFile, updateProgress } = useLibraryStore()
  const {
    isFullscreen,
    toggleFullscreen,
    showControls,
    brightness,
    addBookmark,
    removeBookmark,
    isBookmarked,
    bookmarks,
  } = useReaderStore()

  const [file, setFile] = useState<File | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Modals & Panels
  const [showSettings, setShowSettings] = useState(false)
  const [showBookmarksModal, setShowBookmarksModal] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [showTtsBar, setShowTtsBar] = useState(false)
  const [showTocDrawer, setShowTocDrawer] = useState(false)
  const [toc, setToc] = useState<TocItem[]>([])

  // Renderer reference for imperative actions
  const rendererRef = useRef<any>(null)

  const book = books.find((b) => b.id === bookId)

  useEffect(() => {
    if (!book) return
    const f = getFile(book.id)
    if (f) {
      setFile(f)
      setCurrentPage(book.currentPage || 1)
      setTotalPages(book.totalPages || 1)
    }
  }, [book, getFile])

  const handlePageChange = (page: number, total: number) => {
    setCurrentPage(page)
    setTotalPages(total)
    if (bookId) {
      updateProgress(bookId, page, total)
    }
  }

  const handleJumpToPage = (page: number) => {
    rendererRef.current?.goToPage?.(page)
  }

  const handleToggleBookmark = () => {
    if (!bookId) return
    if (isBookmarked(bookId, currentPage)) {
      const existing = bookmarks.find((b) => b.bookId === bookId && b.page === currentPage)
      if (existing) removeBookmark(existing.id)
    } else {
      addBookmark({
        bookId,
        page: currentPage,
        title: book?.name,
        snippet: rendererRef.current?.getTextForTts?.()?.slice(0, 80) || undefined,
      })
    }
  }

  const handleSearch = async (query: string): Promise<SearchResult[]> => {
    if (rendererRef.current?.searchInBook) {
      return await rendererRef.current.searchInBook(query)
    }
    return []
  }

  const getTextToRead = (): string => {
    if (rendererRef.current?.getTextForTts) {
      return rendererRef.current.getTextForTts()
    }
    return ''
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-4 text-gray-400">
        <p className="text-6xl">📚</p>
        <p className="text-xl font-semibold text-white">Book not found</p>
        <p className="text-sm">It may have been removed from your library.</p>
        <button onClick={() => navigate('/')} className="btn-primary mt-2">
          <ArrowLeft className="w-4 h-4" /> Back to Library
        </button>
      </div>
    )
  }

  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-4 text-gray-400">
        <p className="text-6xl">📂</p>
        <p className="text-xl font-semibold text-white">File not in memory</p>
        <p className="text-sm max-w-sm text-center">
          The file was cleared after a page refresh. Please re-select it from your library.
        </p>
        <button onClick={() => navigate('/')} className="btn-primary mt-2">
          <Upload className="w-4 h-4" /> Open Library
        </button>
      </div>
    )
  }

  const bookmarked = bookId ? isBookmarked(bookId, currentPage) : false

  const renderBook = () => {
    switch (book.format) {
      case 'pdf':
        return (
          <PDFRenderer
            ref={rendererRef}
            file={file}
            onPageChange={handlePageChange}
            initialPage={book.currentPage}
          />
        )
      case 'epub':
        return (
          <EPUBRenderer
            ref={rendererRef}
            file={file}
            onPageChange={handlePageChange}
            onTocLoaded={setToc}
          />
        )
      case 'txt':
        return (
          <TXTRenderer
            ref={rendererRef}
            file={file}
            format="txt"
            onPageChange={handlePageChange}
            initialPage={book.currentPage}
          />
        )
      case 'md':
        return (
          <TXTRenderer
            ref={rendererRef}
            file={file}
            format="md"
            onPageChange={handlePageChange}
            initialPage={book.currentPage}
          />
        )
      case 'html':
        return (
          <TXTRenderer
            ref={rendererRef}
            file={file}
            format="html"
            onPageChange={handlePageChange}
            initialPage={book.currentPage}
          />
        )
      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-400 p-8 text-center">
            <div>
              <p className="text-4xl mb-4">🚫</p>
              <p>
                Format <strong>{book.format}</strong> is not supported yet.
              </p>
            </div>
          </div>
        )
    }
  }

  return (
    <div
      className={clsx(
        'flex flex-col bg-gray-950 relative overflow-hidden transition-all duration-300 w-screen',
        isFullscreen ? 'fixed inset-0 z-50' : 'h-screen'
      )}
    >
      {/* Ambient Brightness Overlay */}
      {brightness < 1.0 && (
        <div
          className="fixed inset-0 pointer-events-none z-30 transition-opacity duration-300"
          style={{ backgroundColor: `rgba(0, 0, 0, ${1.0 - brightness})` }}
        />
      )}

      {/* 🍏 Apple Books Floating Top Navigation Bar */}
      <div
        className={clsx(
          'absolute top-0 left-0 right-0 z-40 transition-all duration-300 transform',
          showControls ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        )}
      >
        <div className="bg-gray-950/85 backdrop-blur-xl border-b border-white/10 px-4 py-2 flex items-center justify-between gap-3 shadow-lg">
          {/* Left section */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => navigate('/')}
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              title="Back to Library"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white truncate max-w-[180px] sm:max-w-xs md:max-w-md">
                {book.name}
              </h2>
              <span className="text-[10px] text-amber-400 uppercase tracking-wider font-mono">
                {book.format} · {Math.round((currentPage / (totalPages || 1)) * 100)}% Complete
              </span>
            </div>
          </div>

          {/* Right section: Apple Books Tools */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Table of Contents */}
            {toc.length > 0 && (
              <button
                onClick={() => setShowTocDrawer((s) => !s)}
                className="p-2 text-gray-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                title="Table of Contents"
              >
                <List className="w-4 h-4" />
              </button>
            )}

            {/* In-Book Search */}
            <button
              onClick={() => setShowSearchModal(true)}
              className="p-2 text-gray-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              title="Search in book"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Read Aloud (TTS) */}
            <button
              onClick={() => setShowTtsBar((s) => !s)}
              className={clsx(
                'p-2 rounded-xl transition-colors',
                showTtsBar
                  ? 'bg-amber-500 text-gray-950'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              )}
              title="Read Aloud (Text-to-speech)"
            >
              <Volume2 className="w-4 h-4" />
            </button>

            {/* Bookmark Current Page */}
            <button
              onClick={handleToggleBookmark}
              className={clsx(
                'p-2 rounded-xl transition-all active:scale-90',
                bookmarked
                  ? 'text-amber-400 bg-amber-500/20'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              )}
              title={bookmarked ? 'Remove bookmark' : 'Bookmark this page'}
            >
              <BookmarkIcon className={clsx('w-4 h-4', bookmarked && 'fill-amber-400')} />
            </button>

            {/* View All Bookmarks */}
            <button
              onClick={() => setShowBookmarksModal(true)}
              className="p-2 text-gray-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors hidden sm:block"
              title="View all bookmarks"
            >
              <span className="text-xs font-semibold px-1 text-gray-400 hover:text-white">Bookmarks</span>
            </button>

            {/* Appearance Aa Menu */}
            <div className="relative">
              <button
                onClick={() => setShowSettings((s) => !s)}
                className={clsx(
                  'p-2 rounded-xl font-serif text-sm font-semibold transition-colors flex items-center gap-1',
                  showSettings
                    ? 'bg-amber-500 text-gray-950'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                )}
                title="Appearance (Aa)"
              >
                <span>Aa</span>
              </button>

              {showSettings && (
                <div className="absolute right-0 top-12 z-50 animate-slide-down">
                  <ReaderSettings />
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 text-gray-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Reading Canvas */}
      <div className="flex-1 overflow-hidden relative">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full text-amber-500 font-medium">
              Loading book renderer…
            </div>
          }
        >
          {renderBook()}
        </Suspense>
      </div>

      {/* 🍏 Apple Books Floating Bottom Page Scrubber Bar */}
      <div
        className={clsx(
          'absolute bottom-0 left-0 right-0 z-40 transition-all duration-300 transform',
          showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        )}
      >
        <div className="bg-gray-950/85 backdrop-blur-xl border-t border-white/10 px-4 py-3 flex flex-col gap-2 max-w-2xl mx-auto rounded-t-2xl shadow-2xl">
          {/* Page Info */}
          <div className="flex items-center justify-between text-xs text-gray-400 select-none px-1">
            <span className="flex items-center gap-1 font-medium text-gray-300">
              <BookOpen className="w-3.5 h-3.5 text-amber-500" />
              Page <span className="text-white font-bold">{currentPage}</span> of {totalPages}
            </span>
            <span className="font-mono text-amber-400 font-medium">
              {Math.round((currentPage / (totalPages || 1)) * 100)}%
            </span>
          </div>

          {/* Scrubber slider & Prev/Next buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleJumpToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1.5 text-gray-300 hover:text-white rounded-lg hover:bg-white/10 disabled:opacity-30 active:scale-95"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <input
              type="range"
              min={1}
              max={totalPages || 1}
              value={currentPage}
              onChange={(e) => handleJumpToPage(Number(e.target.value))}
              className="flex-1 accent-amber-500 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
            />

            <button
              onClick={() => handleJumpToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-1.5 text-gray-300 hover:text-white rounded-lg hover:bg-white/10 disabled:opacity-30 active:scale-95"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals & Drawers */}
      <BookmarksModal
        bookId={book.id}
        isOpen={showBookmarksModal}
        onClose={() => setShowBookmarksModal(false)}
        onJumpToPage={handleJumpToPage}
      />

      <SearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onJumpToPage={handleJumpToPage}
        onSearch={handleSearch}
      />

      {showTtsBar && (
        <TtsBar
          getTextToRead={getTextToRead}
          onClose={() => setShowTtsBar(false)}
        />
      )}

      {/* EPUB TOC Side Drawer */}
      {showTocDrawer && (
        <div className="fixed inset-y-0 left-0 w-80 bg-gray-900/95 backdrop-blur-xl border-r border-gray-800 z-50 p-6 overflow-y-auto animate-slide-right shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <List className="w-4 h-4 text-amber-500" /> Table of Contents
            </h3>
            <button
              onClick={() => setShowTocDrawer(false)}
              className="p-1 rounded-lg text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <ul className="space-y-1">
            {toc.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => {
                    rendererRef.current?.goToPage?.(Number(item.id) || 1)
                    setShowTocDrawer(false)
                  }}
                  className="w-full text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800/80 p-2.5 rounded-xl transition-colors line-clamp-1"
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
