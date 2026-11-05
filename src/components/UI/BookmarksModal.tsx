import { Bookmark, Trash2, X, Clock, ArrowRight } from 'lucide-react'
import { useReaderStore } from '../../store/readerStore'

interface Props {
  bookId: string
  isOpen: boolean
  onClose: () => void
  onJumpToPage: (page: number) => void
}

export default function BookmarksModal({
  bookId,
  isOpen,
  onClose,
  onJumpToPage,
}: Props) {
  const { bookmarks, removeBookmark } = useReaderStore()
  const bookBookmarks = bookmarks
    .filter((b) => b.bookId === bookId)
    .sort((a, b) => a.page - b.page)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-900 border border-gray-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Bookmark className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>Saved Bookmarks</span>
            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
              {bookBookmarks.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {bookBookmarks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Bookmark className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-400" />
              <p className="text-sm font-medium text-gray-300">No bookmarks yet</p>
              <p className="text-xs text-gray-500 mt-1">
                Tap the bookmark ribbon icon in the top toolbar to bookmark any page.
              </p>
            </div>
          ) : (
            bookBookmarks.map((b) => (
              <div
                key={b.id}
                onClick={() => {
                  onJumpToPage(b.page)
                  onClose()
                }}
                className="group flex items-center justify-between p-3 rounded-xl bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 hover:border-amber-500/40 cursor-pointer transition-all"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-amber-400">Page {b.page}</span>
                    {b.title && (
                      <span className="text-xs text-gray-300 truncate font-medium">
                        · {b.title}
                      </span>
                    )}
                  </div>
                  {b.snippet && (
                    <p className="text-xs text-gray-400 truncate mt-1 italic">
                      "{b.snippet}"
                    </p>
                  )}
                  <span className="text-[10px] text-gray-500 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {new Date(b.createdAt).toLocaleDateString()} at{' '}
                    {new Date(b.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeBookmark(b.id)
                    }}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete bookmark"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
