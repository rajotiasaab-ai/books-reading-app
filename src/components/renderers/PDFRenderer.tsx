import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
import { useReaderStore } from '../../store/readerStore'
import { useResponsiveBook } from '../../hooks/useResponsiveBook'
import clsx from 'clsx'

export interface PDFRendererRef {
  getTextForTts: () => string
  searchInBook: (query: string) => Promise<{ page: number; snippet: string }[]>
  goToPage: (page: number) => void
}

interface Props {
  file: File
  onPageChange?: (page: number, total: number) => void
  initialPage?: number
}

const PDFRenderer = forwardRef<PDFRendererRef, Props>(
  ({ file, onPageChange, initialPage = 1 }, ref) => {
    const leftCanvasRef = useRef<HTMLCanvasElement>(null)
    const rightCanvasRef = useRef<HTMLCanvasElement>(null)
    const pdfRef = useRef<any>(null)
    const renderTasksRef = useRef<{ left?: any; right?: any }>({})

    const [currentPage, setCurrentPage] = useState(initialPage)
    const [totalPages, setTotalPages] = useState(0)
    const [scale, setScale] = useState(1.0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [leftPageText, setLeftPageText] = useState('')
    const [rightPageText, setRightPageText] = useState('')

    const { theme, toggleControls } = useReaderStore()

    const { isTwoPage, touchHandlers, containerWidthClass } = useResponsiveBook(
      () => goTo(currentPage - (isTwoPage ? 2 : 1)),
      () => goTo(currentPage + (isTwoPage ? 2 : 1))
    )

    // Load PDF
    useEffect(() => {
      let cancelled = false

      async function loadPDF() {
        try {
          setLoading(true)
          setError(null)

          const pdfjsLib = await import('pdfjs-dist')
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

          const arrayBuffer = await file.arrayBuffer()
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

          if (cancelled) return

          pdfRef.current = pdf
          setTotalPages(pdf.numPages)
          const startP = Math.min(pdf.numPages, Math.max(1, initialPage))
          setCurrentPage(startP)
          onPageChange?.(startP, pdf.numPages)
        } catch (e) {
          if (!cancelled) setError('Failed to load PDF. The file may be password-protected or unsupported.')
        } finally {
          if (!cancelled) setLoading(false)
        }
      }

      loadPDF()
      return () => {
        cancelled = true
      }
    }, [file])

    // Render single canvas helper
    const renderCanvas = async (
      canvas: HTMLCanvasElement,
      pageNum: number,
      targetKey: 'left' | 'right'
    ) => {
      if (!pdfRef.current) return ''
      try {
        if (renderTasksRef.current[targetKey]) {
          renderTasksRef.current[targetKey].cancel()
        }

        const page = await pdfRef.current.getPage(pageNum)
        const viewport = page.getViewport({ scale: scale * 1.3 })
        const ctx = canvas.getContext('2d')!

        canvas.width = viewport.width
        canvas.height = viewport.height

        const renderTask = page.render({ canvasContext: ctx, viewport })
        renderTasksRef.current[targetKey] = renderTask
        await renderTask.promise

        // Extract text for TTS
        const textContent = await page.getTextContent()
        return textContent.items.map((item: any) => item.str).join(' ')
      } catch (e: any) {
        if (e?.name !== 'RenderingCancelledException') {
          console.error('PDF render error:', e)
        }
        return ''
      }
    }

    const renderPages = useCallback(async () => {
      if (!pdfRef.current || loading) return

      // Left page
      if (leftCanvasRef.current && currentPage <= totalPages) {
        const text1 = await renderCanvas(leftCanvasRef.current, currentPage, 'left')
        setLeftPageText(text1)
      }

      // Right page (if two-page spread)
      if (isTwoPage && rightCanvasRef.current) {
        const nextPageNum = currentPage + 1
        if (nextPageNum <= totalPages) {
          const text2 = await renderCanvas(rightCanvasRef.current, nextPageNum, 'right')
          setRightPageText(text2)
        } else {
          // Clear right canvas if past last page
          const ctx = rightCanvasRef.current.getContext('2d')
          ctx?.clearRect(0, 0, rightCanvasRef.current.width, rightCanvasRef.current.height)
          setRightPageText('')
        }
      }
    }, [currentPage, totalPages, isTwoPage, scale, loading])

    useEffect(() => {
      renderPages()
    }, [renderPages])

    const goTo = (page: number) => {
      const p = Math.min(totalPages, Math.max(1, page))
      setCurrentPage(p)
      onPageChange?.(p, totalPages)
    }

    // Keyboard navigation
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          goTo(currentPage - (isTwoPage ? 2 : 1))
        } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
          goTo(currentPage + (isTwoPage ? 2 : 1))
        }
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }, [currentPage, totalPages, isTwoPage])

    // Imperative methods for TTS & Search
    useImperativeHandle(ref, () => ({
      getTextForTts: () => `${leftPageText} ${rightPageText}`,
      searchInBook: async (query: string) => {
        if (!pdfRef.current || !query.trim()) return []
        const matches: { page: number; snippet: string }[] = []
        const q = query.toLowerCase()

        for (let i = 1; i <= Math.min(totalPages, 150); i++) {
          const page = await pdfRef.current.getPage(i)
          const textContent = await page.getTextContent()
          const text = textContent.items.map((item: any) => item.str).join(' ')
          const pos = text.toLowerCase().indexOf(q)
          if (pos !== -1) {
            const start = Math.max(0, pos - 40)
            const end = Math.min(text.length, pos + query.length + 60)
            matches.push({
              page: i,
              snippet: `…${text.slice(start, end).trim()}…`,
            })
            if (matches.length >= 25) break
          }
        }
        return matches
      },
      goToPage: (p: number) => goTo(p),
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

    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-amber-500">
          <RotateCw className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium tracking-wide">Rendering PDF book…</p>
        </div>
      )
    }

    return (
      <div
        className={clsx(
          'w-full h-full flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden select-none relative',
          `theme-${theme}`
        )}
        style={{ backgroundColor: 'var(--app-backdrop)' }}
        {...touchHandlers}
      >
        {/* Apple Books Open Spread Container */}
        <div
          className={clsx(
            'w-full h-full max-h-[96vh] flex items-center justify-center rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 relative',
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
          {/* Left Page Canvas */}
          <div className="flex-1 flex flex-col items-center justify-center h-full p-2 sm:p-4 relative overflow-hidden book-left-page-shadow">
            <canvas
              ref={leftCanvasRef}
              className="max-h-[92vh] max-w-full object-contain rounded-lg shadow-md page-transition-active"
            />
            <div className="absolute bottom-2 left-4 text-[10px] opacity-40 font-mono">
              Page {currentPage} of {totalPages}
            </div>
          </div>

          {/* Right Page Canvas (2-page spread) */}
          {isTwoPage && (
            <div className="flex-1 flex flex-col items-center justify-center h-full p-2 sm:p-4 relative overflow-hidden book-right-page-shadow border-l border-black/5 dark:border-white/5">
              {currentPage + 1 <= totalPages ? (
                <>
                  <canvas
                    ref={rightCanvasRef}
                    className="max-h-[92vh] max-w-full object-contain rounded-lg shadow-md page-transition-active"
                  />
                  <div className="absolute bottom-2 right-4 text-[10px] opacity-40 font-mono">
                    Page {currentPage + 1} of {totalPages}
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center opacity-25 italic text-sm">
                  End of document
                </div>
              )}
            </div>
          )}
        </div>

        {/* Zoom Controls (subtle floating pill) */}
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-1 rounded-xl border border-white/10 text-white/80">
          <button
            onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
            className="p-1 hover:text-white"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono px-1">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
            className="p-1 hover:text-white"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Navigation Arrow buttons */}
        <button
          onClick={() => goTo(currentPage - (isTwoPage ? 2 : 1))}
          disabled={currentPage <= 1}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white backdrop-blur-md transition-all disabled:opacity-0 active:scale-90 z-20 shadow-lg"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => goTo(currentPage + (isTwoPage ? 2 : 1))}
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

PDFRenderer.displayName = 'PDFRenderer'
export default PDFRenderer
