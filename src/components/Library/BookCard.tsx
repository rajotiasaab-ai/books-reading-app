import { Trash2, BookOpen, Clock, Bookmark, ArrowUpRight } from 'lucide-react'
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

// Generates warm, aesthetic book cover gradients like Apple Books
function getCoverGradient(id: string) {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const palettes = [
    'from-amber-900/90 via-amber-950 to-stone-950',
    'from-stone-800 via-stone-900 to-black',
    'from-emerald-950 via-teal-950 to-stone-950',
    'from-blue-950 via-indigo-950 to-slate-950',
    'from-rose-950 via-red-950 to-stone-950',
  ]
  return palettes[hash % palettes.length]
}

export default function BookCard({ book, viewMode, onOpen, onRemove }: Props) {
  const formatBadge = (
    <span
      className={clsx(
        'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shadow-sm',
        getFormatColor(book.format)
      )}
    >
      {book.format}
    </span>
  )

  const coverGradient = getCoverGradient(book.id)

  if (viewMode === 'list') {
    return (
      <div
        className="group flex items-center gap-4 p-4 rounded-2xl bg-gray-900/80 hover:bg-gray-800/90 border border-gray-800 hover:border-amber-500/40 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer select-none"
        onClick={onOpen}
      >
        {/* Apple Books 3D mini spine */}
        <div
          className={clsx(
            'w-12 h-16 rounded-lg bg-gradient-to-br flex flex-col justify-between p-1.5 shadow-lg relative overflow-hidden shrink-0 border border-white/10 group-hover:scale-105 transition-transform',
            coverGradient
          )}
        >
          {/* Spine crease */}
          <div className="absolute inset-y-0 left-0 w-1.5 bg-black/30 border-r border-white/10" />
          <div className="ml-2">{formatBadge}</div>
          <BookOpen className="w-4 h-4 text-white/50 ml-auto" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-base truncate group-hover:text-amber-400 transition-colors">
            {book.name}
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
            <span>{formatFileSize(book.size)}</span>
            {book.lastRead && (
              <span className="flex items-center gap-1 text-gray-400">
                <Clock className="w-3 h-3 text-amber-500" /> Read {formatTime(book.lastRead)}
              </span>
            )}
          </div>
        </div>

        {/* Progress badge */}
        {book.progress > 0 && (
          <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0">
            <span className="text-xs font-mono font-medium text-amber-400">{book.progress}%</span>
            <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden border border-gray-700/50">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                style={{ width: `${book.progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="p-2 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            aria-label="Remove book"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-amber-400 transition-colors" />
        </div>
      </div>
    )
  }

  // 🍏 Apple Books 3D Hardcover Card Presentation
  return (
    <div
      className="group flex flex-col cursor-pointer select-none"
      onClick={onOpen}
    >
      {/* 3D Book Cover */}
      <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-xl group-hover:shadow-2xl group-hover:shadow-amber-500/10 transition-all duration-300 group-hover:-translate-y-1.5 border border-white/10">
        {/* Cover Background */}
        <div
          className={clsx(
            'w-full h-full bg-gradient-to-br flex flex-col justify-between p-4 relative',
            coverGradient
          )}
        >
          {/* Realistic Physical Book Spine Crease & Shadow */}
          <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/50 via-black/20 to-transparent border-r border-white/10 z-10" />
          <div className="absolute inset-y-0 right-0 w-1.5 bg-gradient-to-l from-black/40 to-transparent z-10" />

          {/* Top badge */}
          <div className="flex items-center justify-between z-10 pl-1.5">
            {formatBadge}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="p-1.5 rounded-lg bg-black/50 hover:bg-red-500/80 text-white/70 hover:text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all"
              aria-label="Remove book"
              title="Remove from library"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Center Book Art / Embossed Title */}
          <div className="my-auto text-center px-2 z-10 pl-3">
            <BookOpen className="w-10 h-10 mx-auto text-amber-400/40 mb-2 group-hover:scale-110 transition-transform" />
            <h3 className="text-white font-serif font-bold text-sm line-clamp-3 leading-snug drop-shadow-md">
              {book.name}
            </h3>
          </div>

          {/* Bottom Progress Ribbon */}
          <div className="z-10 pl-1.5">
            {book.progress > 0 ? (
              <div>
                <div className="flex items-center justify-between text-[11px] text-amber-400/90 font-mono mb-1">
                  <span>Progress</span>
                  <span>{book.progress}%</span>
                </div>
                <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden backdrop-blur-sm">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full"
                    style={{ width: `${book.progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-gray-400">
                <Bookmark className="w-3 h-3 text-amber-500" />
                <span>Unread</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Book Title & Meta */}
      <div className="pt-2.5 px-1">
        <h4 className="text-white text-sm font-medium leading-snug line-clamp-1 group-hover:text-amber-400 transition-colors">
          {book.name}
        </h4>
        <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
          <span>{formatFileSize(book.size)}</span>
          {book.lastRead && <span>{formatTime(book.lastRead)}</span>}
        </div>
      </div>
    </div>
  )
}
