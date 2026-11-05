import { Trash2, BookOpen, Clock } from 'lucide-react'
import clsx from 'clsx'
import type { BookMeta } from '../../store/libraryStore'
import { formatFileSize, getFormatColor } from '../../utils/fileDetection'

interface Props {
  book: BookMeta
  viewMode: 'grid' | 'list'
  onOpen: () => void
  onRemove: () => void
}

function formatTime(ts?: number) {
  if (!ts) return null
  const d = new Date(ts)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

export default function BookCard({ book, viewMode, onOpen, onRemove }: Props) {
  const formatBadge = (
    <span className={clsx('text-[10px] font-bold uppercase px-2 py-0.5 rounded border', getFormatColor(book.format))}>
      {book.format}
    </span>
  )

  if (viewMode === 'list') {
    return (
      <div
        className="card flex items-center gap-4 p-4 hover:bg-gray-800/50"
        onClick={onOpen}
      >
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5 text-indigo-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">{book.name}</p>
          <div className="flex items-center gap-3 mt-1">
            {formatBadge}
            <span className="text-xs text-gray-500">{formatFileSize(book.size)}</span>
            {book.lastRead && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {formatTime(book.lastRead)}
              </span>
            )}
          </div>
        </div>

        {/* Progress */}
        {book.progress > 0 && (
          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
            <span className="text-xs text-gray-400">{book.progress}%</span>
            <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${book.progress}%` }} />
            </div>
          </div>
        )}

        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
          aria-label="Remove book"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="card flex flex-col group" onClick={onOpen}>
      {/* Cover */}
      <div className="relative aspect-[2/3] bg-gradient-to-br from-indigo-900/50 to-gray-900 flex items-center justify-center">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.name} className="w-full h-full object-cover" />
        ) : (
          <BookOpen className="w-12 h-12 text-indigo-400/40" />
        )}
        <div className="absolute top-2 left-2">{formatBadge}</div>
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-gray-900/80 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          aria-label="Remove"
        >
          <Trash2 className="w-3 h-3" />
        </button>
        {/* Progress bar */}
        {book.progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
            <div className="h-full bg-indigo-500" style={{ width: `${book.progress}%` }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-white text-sm font-medium leading-tight line-clamp-2 flex-1">{book.name}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">{formatFileSize(book.size)}</span>
          {book.progress > 0 && <span className="text-xs text-indigo-400">{book.progress}%</span>}
        </div>
      </div>
    </div>
  )
}
