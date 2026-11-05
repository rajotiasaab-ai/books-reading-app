import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, Suspense } from 'react'
import { ArrowLeft, Settings, Maximize2, Minimize2, Upload } from 'lucide-react'
import { useLibraryStore } from '../../store/libraryStore'
import { useReaderStore } from '../../store/readerStore'
import ReaderSettings from '../UI/ReaderSettings'
import PDFRenderer from '../renderers/PDFRenderer'
import EPUBRenderer from '../renderers/EPUBRenderer'
import TXTRenderer from '../renderers/TXTRenderer'
import clsx from 'clsx'

export default function Viewer() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const { books, getFile, updateProgress } = useLibraryStore()
  const { isFullscreen, toggleFullscreen } = useReaderStore()
  const [showSettings, setShowSettings] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  const book = books.find(b => b.id === bookId)

  useEffect(() => {
    if (!book) return
    const f = getFile(book.id)
    if (f) {
      setFile(f)
    }
  }, [book])

  const handlePageChange = (page: number, total: number) => {
    if (bookId) updateProgress(bookId, page, total)
  }

  if (!book) return (
    <div className="flex flex-col items-center justify-center h-[80vh] gap-4 text-gray-400">
      <p className="text-6xl">📚</p>
      <p className="text-xl font-semibold text-white">Book not found</p>
      <p className="text-sm">It may have been removed from your library.</p>
      <button onClick={() => navigate('/')} className="btn-primary mt-2">
        <ArrowLeft className="w-4 h-4" /> Back to Library
      </button>
    </div>
  )

  if (!file) return (
    <div className="flex flex-col items-center justify-center h-[80vh] gap-4 text-gray-400">
      <p className="text-6xl">📂</p>
      <p className="text-xl font-semibold text-white">File not available</p>
      <p className="text-sm max-w-sm text-center">
        The file isn't in memory (page was refreshed). Please re-open it from your library by adding it again.
      </p>
      <button onClick={() => navigate('/')} className="btn-primary mt-2">
        <Upload className="w-4 h-4" /> Go to Library
      </button>
    </div>
  )

  const renderBook = () => {
    switch (book.format) {
      case 'pdf':
        return <PDFRenderer file={file} onPageChange={handlePageChange} initialPage={book.currentPage} />
      case 'epub':
        return <EPUBRenderer file={file} onPageChange={handlePageChange} />
      case 'txt':
        return <TXTRenderer file={file} format="txt" onPageChange={handlePageChange} />
      case 'md':
        return <TXTRenderer file={file} format="md" onPageChange={handlePageChange} />
      case 'html':
        return <TXTRenderer file={file} format="html" onPageChange={handlePageChange} />
      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-400 p-8 text-center">
            <div>
              <p className="text-4xl mb-4">🚫</p>
              <p>Format <strong>{book.format}</strong> is not yet supported for viewing.</p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className={clsx(
      'flex flex-col bg-gray-950',
      isFullscreen ? 'fixed inset-0 z-50' : 'h-[calc(100vh-56px)]'
    )}>
      {/* Viewer toolbar */}
      <div className="flex items-center justify-between gap-4 px-4 py-2 bg-gray-950/95 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/')} className="btn-ghost p-1.5 shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{book.name}</p>
            <p className="text-gray-500 text-xs capitalize">{book.format} · {book.progress > 0 ? `${book.progress}% read` : 'Just started'}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <div className="relative">
            <button
              onClick={() => setShowSettings(s => !s)}
              className={clsx('btn-ghost p-2', showSettings && 'bg-gray-800 text-white')}
              aria-label="Reader settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            {showSettings && (
              <div className="absolute right-0 top-10 z-50">
                <ReaderSettings />
              </div>
            )}
          </div>
          <button onClick={toggleFullscreen} className="btn-ghost p-2" aria-label="Toggle fullscreen">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Book content */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full text-gray-400">
            Loading renderer…
          </div>
        }>
          {renderBook()}
        </Suspense>
      </div>
    </div>
  )
}
