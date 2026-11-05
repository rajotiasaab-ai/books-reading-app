import { useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react'
import { marked } from 'marked'
import { RotateCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { useReaderStore } from '../../store/readerStore'
import { useResponsiveBook } from '../../hooks/useResponsiveBook'
import clsx from 'clsx'

export interface TXTRendererRef {
  getTextForTts: () => string
  searchInBook: (query: string) => { page: number; snippet: string }[]
  goToPage: (page: number) => void
}

interface Props {
  file: File
  format: 'txt' | 'md' | 'html'
  onPageChange?: (page: number, total: number) => void
  initialPage?: number
}

const TXTRenderer = forwardRef<TXTRendererRef, Props>(
  ({ file, format, onPageChange, initialPage = 1 }, ref) => {
    const [htmlContent, setHtmlContent] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Pagination state
    const [currentPage, setCurrentPage] = useState(initialPage)
    const [totalPages, setTotalPages] = useState(1)
    const [pages, setPages] = useState<string[]>([])

    const { theme, fontSize, lineHeight, fontFamily, readingWidth, toggleControls } =
      useReaderStore()

    // Load file text
    useEffect(() => {
      let cancelled = false
      async function loadFile() {
        try {
          setLoading(true)
          const text = await file.text()
          if (cancelled) return

          let parsed = ''
          if (format === 'md') {
            parsed = await marked(text, { breaks: true, gfm: true })
          } else if (format === 'html') {
            parsed = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          } else {
            // TXT
            parsed = text
              .split(/\n\n+/)
              .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
              .join('\n')
          }

          setHtmlContent(parsed)
        } catch (e) {
          if (!cancelled) setError('Failed to read the file.')
        } finally {
          if (!cancelled) setLoading(false)
        }
      }
      loadFile()
      return () => {
        cancelled = true
      }
    }, [file, format])

    // Break text content into book pages based on character budget and screen size
    const { isTwoPage, touchHandlers, containerWidthClass } = useResponsiveBook(
      () => goTo(currentPage - (isTwoPage ? 2 : 1)),
      () => goTo(currentPage + (isTwoPage ? 2 : 1))
    )

    useEffect(() => {
      if (!htmlContent) return

      // Approximate words per page based on font size and line height
      // Target ~250-350 words per page (Apple Books standard)
      const baseWordsPerPage = Math.max(160, Math.floor(340 * (18 / fontSize)))

      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = htmlContent
      const paragraphs = Array.from(tempDiv.children).map((el) => el.outerHTML)

      if (paragraphs.length === 0 && tempDiv.textContent) {
        paragraphs.push(`<p>${tempDiv.textContent}</p>`)
      }

      const generatedPages: string[] = []
      let currentPageHtml = ''
      let currentWordCount = 0

      for (const p of paragraphs) {
        const textCount = (p.replace(/<[^>]+>/g, '').match(/\S+/g) || []).length

        if (currentWordCount + textCount > baseWordsPerPage && currentPageHtml) {
          generatedPages.push(currentPageHtml)
          currentPageHtml = p
          currentWordCount = textCount
        } else {
          currentPageHtml += p
          currentWordCount += textCount
        }
      }

      if (currentPageHtml) {
        generatedPages.push(currentPageHtml)
      }

      const total = Math.max(1, generatedPages.length)
      setPages(generatedPages)
      setTotalPages(total)

      const safePage = Math.min(total, Math.max(1, currentPage))
      setCurrentPage(safePage)
      onPageChange?.(safePage, total)
    }, [htmlContent, fontSize, lineHeight, readingWidth])

    const goTo = useCallback(
      (pageNum: number) => {
        const p = Math.min(totalPages, Math.max(1, pageNum))
        setCurrentPage(p)
        onPageChange?.(p, totalPages)
      },
      [totalPages, onPageChange]
    )

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
    }, [currentPage, totalPages, isTwoPage, goTo])

    // Expose methods for Viewer toolbar (TTS, Search, direct jump)
    useImperativeHandle(ref, () => ({
      getTextForTts: () => {
        const p1 = pages[currentPage - 1] || ''
        const p2 = isTwoPage && currentPage < totalPages ? pages[currentPage] || '' : ''
        return `${p1} ${p2}`.replace(/<[^>]+>/g, ' ')
      },
      searchInBook: (query: string) => {
        if (!query.trim()) return []
        const q = query.toLowerCase()
        const matches: { page: number; snippet: string }[] = []

        pages.forEach((p, idx) => {
          const plain = p.replace(/<[^>]+>/g, ' ')
          const pos = plain.toLowerCase().indexOf(q)
          if (pos !== -1) {
            const start = Math.max(0, pos - 40)
            const end = Math.min(plain.length, pos + query.length + 60)
            const snippet = `…${plain.slice(start, end).trim()}…`
            matches.push({ page: idx + 1, snippet })
          }
        })
        return matches.slice(0, 30)
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
          <p className="text-sm font-medium tracking-wide">Opening book…</p>
        </div>
      )
    }

    const fontFamilyMap = {
      serif: "'Lora', Georgia, serif",
      merriweather: "'Merriweather', Georgia, serif",
      sans: "'Inter', system-ui, -apple-system, sans-serif",
      mono: "'JetBrains Mono', monospace",
    }

    const currentFont = fontFamilyMap[fontFamily]

    // Left page content & Right page content (for two-page spread)
    const leftPageIdx = currentPage - 1
    const rightPageIdx = isTwoPage ? currentPage : -1

    const leftContent = pages[leftPageIdx] || ''
    const rightContent = rightPageIdx !== -1 && rightPageIdx < totalPages ? pages[rightPageIdx] : ''

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
            color: 'var(--book-text)',
            boxShadow: 'var(--book-shadow)',
            border: '1px solid var(--book-border)',
          }}
        >
          {/* Left Page (or Single Page) */}
          <div
            className={clsx(
              'flex-1 flex flex-col h-full relative overflow-hidden',
              isTwoPage ? 'book-left-page-shadow rounded-l-2xl pr-4 sm:pr-8' : 'rounded-2xl px-4 sm:px-12'
            )}
            onClick={(e) => {
              // Click center to toggle UI, or edges to navigate
              const rect = e.currentTarget.getBoundingClientRect()
              const clickX = e.clientX - rect.left
              if (clickX < rect.width * 0.2) {
                goTo(currentPage - (isTwoPage ? 2 : 1))
              } else if (clickX > rect.width * 0.8 && !isTwoPage) {
                goTo(currentPage + 1)
              } else {
                toggleControls()
              }
            }}
          >
            {/* Running Header */}
            <div className="pt-4 pb-2 px-6 flex items-center justify-between text-[11px] opacity-40 uppercase tracking-widest border-b border-black/5 dark:border-white/5 select-none shrink-0">
              <span className="truncate max-w-[200px]">{file.name.replace(/\.[^.]+$/, '')}</span>
              <span>Page {currentPage}</span>
            </div>

            {/* Page Body */}
            <div
              className="flex-1 overflow-y-auto px-6 py-6 prose leading-relaxed page-transition-active"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: lineHeight,
                fontFamily: currentFont,
                color: 'inherit',
              }}
              dangerouslySetInnerHTML={{ __html: leftContent }}
            />

            {/* Running Footer */}
            <div className="py-3 px-6 flex items-center justify-between text-[11px] opacity-40 select-none border-t border-black/5 dark:border-white/5 shrink-0">
              <span>{Math.round((currentPage / totalPages) * 100)}%</span>
              <span>{currentPage}</span>
            </div>
          </div>

          {/* Right Page (Two-Page Spread only) */}
          {isTwoPage && (
            <div
              className="flex-1 flex flex-col h-full relative overflow-hidden book-right-page-shadow rounded-r-2xl pl-4 sm:pl-8 border-l border-black/5 dark:border-white/5"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const clickX = e.clientX - rect.left
                if (clickX > rect.width * 0.8) {
                  goTo(currentPage + 2)
                } else {
                  toggleControls()
                }
              }}
            >
              {/* Running Header */}
              <div className="pt-4 pb-2 px-6 flex items-center justify-between text-[11px] opacity-40 uppercase tracking-widest border-b border-black/5 dark:border-white/5 select-none shrink-0">
                <span>{rightContent ? `Page ${currentPage + 1}` : ''}</span>
                <span className="truncate max-w-[200px]">Chapter {Math.ceil(currentPage / 10)}</span>
              </div>

              {/* Page Body */}
              <div
                className="flex-1 overflow-y-auto px-6 py-6 prose leading-relaxed page-transition-active"
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: lineHeight,
                  fontFamily: currentFont,
                  color: 'inherit',
                }}
                dangerouslySetInnerHTML={{
                  __html: rightContent || '<div class="h-full flex items-center justify-center opacity-30 italic">End of book</div>',
                }}
              />

              {/* Running Footer */}
              <div className="py-3 px-6 flex items-center justify-between text-[11px] opacity-40 select-none border-t border-black/5 dark:border-white/5 shrink-0">
                <span>{Math.round(((currentPage + 1) / totalPages) * 100)}%</span>
                <span>{rightContent ? currentPage + 1 : ''}</span>
              </div>
            </div>
          )}
        </div>

        {/* Floating Quick Edge Navigation Buttons */}
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

TXTRenderer.displayName = 'TXTRenderer'
export default TXTRenderer
