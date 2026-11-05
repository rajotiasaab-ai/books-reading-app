import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCw, List } from 'lucide-react'
import { useReaderStore } from '../../store/readerStore'

interface TocItem {
  id: string
  label: string
  href: string
}

interface Props {
  file: File
  onPageChange?: (page: number, total: number) => void
}

export default function EPUBRenderer({ file, onPageChange }: Props) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<any>(null)
  const renditionRef = useRef<any>(null)
  const { theme, fontSize, lineHeight, fontFamily } = useReaderStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toc, setToc] = useState<TocItem[]>([])
  const [showToc, setShowToc] = useState(false)

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
          spread: 'none',
        })
        renditionRef.current = rendition

        await book.ready
        if (cancelled) return

        // Set themes
        rendition.themes.register('light', {
          body: { background: '#ffffff', color: '#1a1a1a' }
        })
        rendition.themes.register('sepia', {
          body: { background: '#fdf8f0', color: '#3d2b1a' }
        })
        rendition.themes.register('dark', {
          body: { background: '#1a1a2e', color: '#e0e0e0' }
        })
        rendition.themes.select(theme)

        // Extract TOC
        const navigation = await book.loaded.navigation
        if (navigation?.toc) {
          setToc(navigation.toc.map((item: any) => ({
            id: item.id ?? item.href,
            label: item.label?.trim() ?? item.href,
            href: item.href,
          })))
        }

        rendition.on('locationChanged', (loc: any) => {
          const total = (book.spine as any)?.spineItems?.length ?? (book.spine as any)?.items?.length ?? 1
          const idx = (book.spine as any)?.get?.(loc?.start?.cfi)?.index ?? 0
          onPageChange?.(idx + 1, total)
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
  }, [file])

  // Apply reader settings changes
  useEffect(() => {
    if (!renditionRef.current) return
    renditionRef.current.themes.select(theme)
    renditionRef.current.themes.fontSize(`${fontSize}px`)
    renditionRef.current.themes.override('line-height', String(lineHeight))
    renditionRef.current.themes.override(
      'font-family',
      fontFamily === 'serif' ? "'Lora', Georgia, serif" : "'Inter', system-ui, sans-serif"
    )
  }, [theme, fontSize, lineHeight, fontFamily])

  const prevPage = () => renditionRef.current?.prev()
  const nextPage = () => renditionRef.current?.next()
  const goToHref = (href: string) => { renditionRef.current?.display(href); setShowToc(false) }

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevPage()
      if (e.key === 'ArrowRight') nextPage()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (error) return (
    <div className="flex items-center justify-center h-full text-red-400 p-8 text-center">
      <div><p className="text-4xl mb-4">⚠️</p><p>{error}</p></div>
    </div>
  )

  return (
    <div className="flex flex-col h-full relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/80 border-b border-gray-800 shrink-0">
        <button onClick={() => setShowToc(s => !s)} className="btn-ghost text-sm">
          <List className="w-4 h-4" /> Contents
        </button>
        <div className="flex items-center gap-2">
          <button onClick={prevPage} className="btn-ghost p-1.5">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={nextPage} className="btn-ghost p-1.5">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TOC drawer */}
      {showToc && (
        <div className="absolute top-12 left-0 bottom-0 w-72 bg-gray-900 border-r border-gray-700 z-20 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-white font-semibold mb-3">Table of Contents</h3>
            <ul className="space-y-1">
              {toc.map(item => (
                <li key={item.id}>
                  <button
                    onClick={() => goToHref(item.href)}
                    className="w-full text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800 px-3 py-2 rounded-lg transition-colors"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* EPUB viewer */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400 bg-gray-900 z-10">
            <RotateCw className="w-8 h-8 animate-spin" />
            <p>Loading EPUB…</p>
          </div>
        )}
        <div ref={viewerRef} className="w-full h-full" />
      </div>

      {/* Swipe zones */}
      <button
        onClick={prevPage}
        className="absolute left-0 top-12 bottom-0 w-16 opacity-0 hover:opacity-100 flex items-center justify-start pl-2 transition-opacity"
        aria-label="Previous page"
      >
        <div className="bg-gray-900/80 rounded-r-lg p-2">
          <ChevronLeft className="w-6 h-6 text-white" />
        </div>
      </button>
      <button
        onClick={nextPage}
        className="absolute right-0 top-12 bottom-0 w-16 opacity-0 hover:opacity-100 flex items-center justify-end pr-2 transition-opacity"
        aria-label="Next page"
      >
        <div className="bg-gray-900/80 rounded-l-lg p-2">
          <ChevronRight className="w-6 h-6 text-white" />
        </div>
      </button>
    </div>
  )
}
