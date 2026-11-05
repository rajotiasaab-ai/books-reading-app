import { useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, BookOpen, Grid3X3, List, Filter } from 'lucide-react'
import { useLibraryStore } from '../../store/libraryStore'
import { detectFormat, generateId, ACCEPT_ATTR, type BookFormat } from '../../utils/fileDetection'
import BookCard from './BookCard'
import clsx from 'clsx'

const FORMAT_OPTIONS: { value: BookFormat | 'all'; label: string }[] = [
  { value: 'all',   label: 'All Formats' },
  { value: 'pdf',   label: 'PDF' },
  { value: 'epub',  label: 'EPUB' },
  { value: 'txt',   label: 'TXT' },
  { value: 'md',    label: 'Markdown' },
  { value: 'html',  label: 'HTML' },
]

export default function Library() {
  const navigate = useNavigate()
  const { books, addBook, removeBook, sortBy, setSortBy, filterFormat, setFilterFormat } = useLibraryStore()
  const [isDragging, setIsDragging] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach(file => {
      const format = detectFormat(file)
      if (format === 'unknown') return
      addBook({
        id: generateId(),
        name: file.name.replace(/\.[^.]+$/, ''),
        format,
        size: file.size,
        file,
        addedAt: Date.now(),
        progress: 0,
        currentPage: 1,
        totalPages: 0,
      })
    })
  }, [addBook])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    processFiles(e.dataTransfer.files)
  }, [processFiles])

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const onDragLeave = () => setIsDragging(false)

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files)
    e.target.value = ''
  }

  const sortedBooks = [...books]
    .filter(b => filterFormat === 'all' || b.format === filterFormat)
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'lastRead') return (b.lastRead ?? 0) - (a.lastRead ?? 0)
      if (sortBy === 'progress') return b.progress - a.progress
      return b.addedAt - a.addedAt
    })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">My Library</h1>
        <p className="text-gray-400 text-sm">{books.length} book{books.length !== 1 ? 's' : ''} · Read PDF, EPUB, TXT and more</p>
      </div>

      {/* Drop zone */}
      <div
        className={clsx('drop-zone mb-8', isDragging && 'drag-over')}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center gap-3 pointer-events-none">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Upload className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-lg">Drop books here</p>
            <p className="text-gray-400 text-sm mt-1">or click to browse · PDF, EPUB, TXT, Markdown, HTML</p>
          </div>
          <span className="btn-primary text-sm pointer-events-auto" onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}>
            <BookOpen className="w-4 h-4" /> Choose Files
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          onChange={onFileInput}
          className="hidden"
        />
      </div>

      {/* Controls */}
      {books.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterFormat}
              onChange={e => setFilterFormat(e.target.value as BookFormat | 'all')}
              className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              {FORMAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="addedAt">Recently Added</option>
            <option value="lastRead">Recently Read</option>
            <option value="name">Title A–Z</option>
            <option value="progress">Progress</option>
          </select>

          <div className="ml-auto flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-lg p-1">
            <button onClick={() => setViewMode('grid')} className={clsx('p-1.5 rounded', viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white')}>
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')} className={clsx('p-1.5 rounded', viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white')}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Book grid */}
      {sortedBooks.length > 0 ? (
        <div className={clsx(
          viewMode === 'grid'
            ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
            : 'flex flex-col gap-3'
        )}>
          {sortedBooks.map(book => (
            <BookCard
              key={book.id}
              book={book}
              viewMode={viewMode}
              onOpen={() => navigate(`/read/${book.id}`)}
              onRemove={() => removeBook(book.id)}
            />
          ))}
        </div>
      ) : books.length === 0 ? null : (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">No books match the selected filter.</p>
        </div>
      )}
    </div>
  )
}
