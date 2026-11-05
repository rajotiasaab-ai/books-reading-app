import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, RotateCw, List } from 'lucide-react'
import { useReaderStore } from '../../store/readerStore'
import { useResponsiveBook } from '../../hooks/useResponsiveBook'
import clsx from 'clsx'

export interface EPUBRendererRef {
  getTextForTts: () => string
  searchInBook: (query: string) => Promise<{ page: number; snippet: string }[]>
  goToPage: (page: number) => void
  getToc: () => TocItem[]
}

export interface TocItem {
  id: string
  label: string
  href: string
}

interface Props {
  file: File
  onPageChange?: (page: number, total: number) => void
  onTocLoaded?: (toc: TocItem[]) => void
}

const EPUBRenderer = forwardRef<EPUBRendererRef, Props>(
  ({ file, onPageChange, onTocLoaded }, ref) => {
    const viewerRef = useRef<HTMLDivElement>(null)
    const bookRef = useRef<any>(null)
    const renditionRef = useRef<any>(null)

    const { theme, fontSize, lineHeight, fontFamily, toggleControls } = useReaderStore()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [toc, setToc] = useState<TocItem[]>([])
    const [showToc, setShowToc] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)

    const prevPage = useCallback(() => renditionRef.current?.prev(), [])
    const nextPage = useCallback(() => renditionRef.current?.next(), [])

    const { isTwoPage, touchHandlers, containerWidthClass } = useResponsiveBook(
      prevPage,
      nextPage
    )

    // Load EPUB
    useEffect(() => {
      if (!viewerRef.current) return
      let cancelled = false

      async function loadEpub() {
        try {
          setLoading(true)
          setError(null)

          const epubjs = (await import('epubjs')).default
          const arrayBuffer = await file.arrayBuffer()

          const book = epubjs(arrayBuffer)
          bookRef.current = book

          const rendition = book.renderTo(viewerRef.current!, {
            width: '100%',
            height: '100%',
            flow: 'paginated',
            spread: isTwoPage ? 'auto' : 'none',
          })
          renditionRef.current = rendition

          await book.ready
          if (cancelled) return

          // Register Apple Books themes
          rendition.themes.register('light', {
            body: { background: '#ffffff', color: '#1c1c1e', padding: '0 24px' },
          })
          rendition.themes.register('sepia', {
            body: { background: '#fbf0d9', color: '#3d2b1f', padding: '0 24px' },
          })
          rendition.themes.register('slate', {
            body: { background: '#242426', color: '#e5e5ea', padding: '0 24px' },
          })
          rendition.themes.register('dark', {
            body: { background: '#000000', color: '#d1d1d6', padding: '0 24px' },
          })

          rendition.themes.select(theme)

          // Load navigation / TOC
          const navigation = await book.loaded.navigation
          if (navigation?.toc) {
            const parsedToc = navigation.toc.map((item: any) => ({
              id: item.id ?? item.href,
              label: item.label?.trim() ?? item.href,
              href: item.href,
            }))
            setToc(parsedToc)
            onTocLoaded?.(parsedToc)
          }

          // Handle location changes
          rendition.on('locationChanged', (loc: any) => {
            const total =
              (book.spine as any)?.spineItems?.length ??
              (book.spine as any)?.items?.length ??
              1
            const idx = (book.spine as any)?.get?.(loc?.start?.cfi)?.index ?? 0
            const p = idx + 1
            setCurrentPage(p)
            setTotalPages(total)
            onPageChange?.(p, total)
          })

          await rendition.display()
          setLoading(false)
        } catch (e) {
          if (!cancelled) {
            setError('Failed to load EPUB. The file may be corrupted.')
            setLoading(false)
          }
        }
      }

      loadEpub()
      return () => {
        cancelled = true
        bookRef.current?.destroy()
      }
    }, [file, isTwoPage])

    // Update typography settings dynamically
    useEffect(() => {
      if (!renditionRef.current) return
      renditionRef.current.themes.select(theme)
      renditionRef.current.themes.fontSize(`${fontSize}px`)
      renditionRef.current.themes.override('line-height', String(lineHeight))

      const fontFamilies = {
        serif: "'Lora', Georgia, serif",
        merriweather: "'Merriweather', Georgia, serif",
        sans: "'Inter', system-ui, sans-serif",
        mono: "'JetBrains Mono', monospace",
      }
      renditionRef.current.themes.override('font-family', fontFamilies[fontFamily])
    }, [theme, fontSize, lineHeight, fontFamily])

    const goToHref = (href: string) => {
      renditionRef.current?.display(href)
      setShowToc(false)
    }

    // Keyboard navigation
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        if (e.key === 'ArrowLeft') prevPage()
        if (e.key === 'ArrowRight' || e.key === ' ') nextPage()
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }, [prevPage, nextPage])

    // Imperative methods for Viewer
    useImperativeHandle(ref, () => ({
      getTextForTts: () => {
        try {
          const contents = renditionRef.current?.getContents()
          if (contents && contents[0]?.document?.body) {
            return contents[0].document.body.innerText || ''
          }
        } catch (e) {
          console.error(e)
        }
        return ''
      },
      searchInBook: async (query: string) => {
        if (!bookRef.current || !query.trim()) return []
        const matches: { page: number; snippet: string }[] = []
        try {
          const spine = (bookRef.current.spine as any)?.spineItems || []
          for (let i = 0; i < Math.min(spine.length, 40); i++) {
            const item = spine[i]
            await item.load(bookRef.current.load.bind(bookRef.current))
            const text = item.document?.body?.innerText || ''
            const pos = text.toLowerCase().indexOf(query.toLowerCase())
            if (pos !== -1) {
              const start = Math.max(0, pos - 40)
              const end = Math.min(text.length, pos + query.length + 60)
              matches.push({
                page: i + 1,
                snippet: `…${text.slice(start, end).trim()}…`,
              })
              if (matches.length >= 25) break
            }
          }
        } catch (e) {
          console.error('EPUB search error:', e)
        }
        return matches
      },
      goToPage: (page: number) => {
        const spine = (bookRef.current.spine as any)?.spineItems || []
        const item = spine[page - 1]
        if (item?.href) renditionRef.current?.display(item.href)
      },
      getToc: () => toc,
    }))

    if (error) {
      return (
        <div className="flex items-center justify-center h-full text-red-400 p-8 text-center">
          <div>
            <p className="text-4xl mb-4">⚠️</p>
            <p>{error}</p>
          </div>
        </div>
      )
    }

    return (
      <div
        className={clsx(
          'w-full h-full flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden select-none relative',
          `theme-${theme}`
        )}
        style={{ backgroundColor: 'var(--app-backdrop)' }}
        {...touchHandlers}
      >
        {/* Apple Books Open Spread Container */}
        <div
          className={clsx(
            'w-full h-full max-h-[96vh] flex rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 relative',
            containerWidthClass,
            isTwoPage && 'book-spine-crease'
          )}
          style={{
            backgroundColor: 'var(--book-bg)',
            boxShadow: 'var(--book-shadow)',
            border: '1px solid var(--book-border)',
          }}
          onClick={toggleControls}
        >
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-amber-500 bg-black/10 backdrop-blur-sm z-30">
              <RotateCw className="w-8 h-8 animate-spin" />
              <p className="text-sm font-medium tracking-wide">Opening EPUB book…</p>
            </div>
          )}

          {/* Viewer inner container */}
          <div ref={viewerRef} className="w-full h-full page-transition-active" />
        </div>

        {/* Quick TOC Drawer */}
        {showToc && (
          <div className="fixed inset-y-0 left-0 w-80 bg-gray-900/95 backdrop-blur-xl border-r border-gray-800 z-50 p-6 overflow-y-auto animate-slide-right shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <List className="w-4 h-4 text-amber-500" /> Table of Contents
              </h3>
              <button
                onClick={() => setShowToc(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <ul className="space-y-1">
              {toc.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => goToHref(item.href)}
                    className="w-full text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800/80 p-2.5 rounded-xl transition-colors line-clamp-1"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Floating Page Navigation */}
        <button
          onClick={prevPage}
          disabled={currentPage <= 1}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white backdrop-blur-md transition-all disabled:opacity-0 active:scale-90 z-20 shadow-lg"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={nextPage}
          disabled={currentPage >= totalPages}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white backdrop-blur-md transition-all disabled:opacity-0 active:scale-90 z-20 shadow-lg"
          aria-label="Next Page"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    )
  }
)

EPUBRenderer.displayName = 'EPUBRenderer'
export default EPUBRenderer
