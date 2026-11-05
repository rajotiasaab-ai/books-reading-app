import React, { useState, useEffect } from 'react'
import { Search, X, ArrowRight, CornerDownLeft, Loader2 } from 'lucide-react'

export interface SearchResult {
  page: number
  snippet: string
  chapter?: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onJumpToPage: (page: number) => void
  onSearch?: (query: string) => Promise<SearchResult[]> | SearchResult[]
}

export default function SearchModal({
  isOpen,
  onClose,
  onJumpToPage,
  onSearch,
}: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setResults([])
      setHasSearched(false)
    }
  }, [isOpen])

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!query.trim() || !onSearch) return

    setIsSearching(true)
    setHasSearched(true)
    try {
      const res = await onSearch(query.trim())
      setResults(res)
    } catch (err) {
      console.error('Search error:', err)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-900 border border-gray-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search input form */}
        <form onSubmit={handleSearch} className="flex items-center px-4 py-3 border-b border-gray-800 gap-3">
          <Search className="w-5 h-5 text-amber-500 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search words, phrases, or chapters in this book…"
            className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setResults([])
                setHasSearched(false)
              }}
              className="p-1 text-gray-500 hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            disabled={!query.trim() || isSearching}
            className="btn-primary py-1.5 px-3 text-xs shrink-0 disabled:opacity-40"
          >
            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CornerDownLeft className="w-3.5 h-3.5" />}
            <span>Find</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </form>

        {/* Results */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-xs">Searching through pages…</p>
            </div>
          ) : results.length > 0 ? (
            <div>
              <p className="text-xs text-gray-400 mb-2 px-1">
                Found {results.length} result{results.length !== 1 ? 's' : ''} for "{query}":
              </p>
              {results.map((r, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    onJumpToPage(r.page)
                    onClose()
                  }}
                  className="group flex items-start justify-between p-3 rounded-xl bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 hover:border-amber-500/40 cursor-pointer transition-all mb-2"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        Page {r.page}
                      </span>
                      {r.chapter && (
                        <span className="text-xs text-gray-400 truncate">
                          {r.chapter}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                      {r.snippet}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all mt-1 shrink-0" />
                </div>
              ))}
            </div>
          ) : hasSearched ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm font-medium text-gray-300">No matches found</p>
              <p className="text-xs text-gray-500 mt-1">
                Try searching for a different keyword or variation.
              </p>
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">
              <p className="text-xs text-gray-400">
                Type a keyword and press Enter to search across the entire book.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

