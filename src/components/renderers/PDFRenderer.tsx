import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  file: File
  onPageChange?: (page: number, total: number) => void
  initialPage?: number
}

export default function PDFRenderer({ file, onPageChange, initialPage = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfRef = useRef<any>(null)
  const renderTaskRef = useRef<any>(null)

  const [currentPage, setCurrentPage] = useState(initialPage)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageInput, setPageInput] = useState(String(initialPage))

  // Load PDF.js dynamically
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
        setCurrentPage(1)
        setPageInput('1')
        onPageChange?.(1, pdf.numPages)
      } catch (e) {
        if (!cancelled) setError('Failed to load PDF. The file may be corrupted or password-protected.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPDF()
    return () => { cancelled = true }
  }, [file])

  const renderPage = useCallback(async (pageNum: number, scaleVal: number) => {
    if (!pdfRef.current || !canvasRef.current) return

    try {
      // Cancel previous render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
      }

      const page = await pdfRef.current.getPage(pageNum)
      const viewport = page.getViewport({ scale: scaleVal })
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')!

      canvas.width = viewport.width
      canvas.height = viewport.height

      const renderTask = page.render({ canvasContext: context, viewport })
      renderTaskRef.current = renderTask
      await renderTask.promise
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') {
        console.error('Render error:', e)
      }
    }
  }, [])

  useEffect(() => {
    if (!loading && pdfRef.current) {
      renderPage(currentPage, scale)
      onPageChange?.(currentPage, totalPages)
    }
  }, [currentPage, scale, loading])

  const goTo = (page: number) => {
    const p = Math.min(totalPages, Math.max(1, page))
    setCurrentPage(p)
    setPageInput(String(p))
  }

  const handlePageInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') goTo(parseInt(pageInput) || currentPage)
  }

  if (error) return (
    <div className="flex items-center justify-center h-full text-red-400 p-8 text-center">
      <div>
        <p className="text-4xl mb-4">⚠️</p>
        <p>{error}</p>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 px-4 py-2 bg-gray-900/80 border-b border-gray-800 shrink-0">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button onClick={() => goTo(currentPage - 1)} disabled={currentPage <= 1} className="btn-ghost p-1.5 disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 text-sm text-gray-300">
            <input
              type="number"
              value={pageInput}
              onChange={e => setPageInput(e.target.value)}
              onKeyDown={handlePageInput}
              onBlur={() => goTo(parseInt(pageInput) || currentPage)}
              className="w-12 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-center text-xs focus:outline-none focus:border-indigo-500"
            />
            <span className="text-gray-500">/ {totalPages}</span>
          </div>
          <button onClick={() => goTo(currentPage + 1)} disabled={currentPage >= totalPages} className="btn-ghost p-1.5 disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-2">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="btn-ghost p-1.5">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-400 w-12 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="btn-ghost p-1.5">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-gray-800 flex items-start justify-center p-4">
        {loading ? (
          <div className="flex flex-col items-center gap-3 mt-20 text-gray-400">
            <RotateCw className="w-8 h-8 animate-spin" />
            <p>Loading PDF…</p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className={clsx('shadow-2xl rounded', scale > 1 ? '' : 'max-w-full')}
          />
        )}
      </div>
    </div>
  )
}
