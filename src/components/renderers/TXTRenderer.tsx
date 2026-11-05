import React, { useEffect, useState, useRef } from 'react'
import { marked } from 'marked'
import { RotateCw } from 'lucide-react'
import { useReaderStore } from '../../store/readerStore'

interface Props {
  file: File
  format: 'txt' | 'md' | 'html'
  onPageChange?: (page: number, total: number) => void
}

export default function TXTRenderer({ file, format, onPageChange }: Props) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { theme, fontSize, lineHeight, fontFamily } = useReaderStore()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    async function loadFile() {
      try {
        setLoading(true)
        const text = await file.text()
        if (cancelled) return

        let html = ''
        if (format === 'md') {
          html = await marked(text, { breaks: true, gfm: true })
        } else if (format === 'html') {
          // Sanitize by stripping scripts
          html = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        } else {
          // Plain text: convert newlines to paragraphs
          html = text
            .split(/\n\n+/)
            .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
            .join('\n')
        }

        setContent(html)
        onPageChange?.(1, 1)
      } catch (e) {
        if (!cancelled) setError('Failed to read the file.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadFile()
    return () => { cancelled = true }
  }, [file, format])

  const themeStyles: Record<string, React.CSSProperties> = {
    light: { background: '#ffffff', color: '#1a1a1a' },
    sepia: { background: '#fdf8f0', color: '#3d2b1a' },
    dark:  { background: '#0f0f1a', color: '#e0e0e0' },
  }

  if (error) return (
    <div className="flex items-center justify-center h-full text-red-400 p-8 text-center">
      <div><p className="text-4xl mb-4">⚠️</p><p>{error}</p></div>
    </div>
  )

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
      <RotateCw className="w-8 h-8 animate-spin" />
      <p>Loading…</p>
    </div>
  )

  return (
    <div
      className="h-full overflow-y-auto"
      style={themeStyles[theme]}
    >
      <div
        ref={containerRef}
        className="max-w-3xl mx-auto px-6 py-10 prose prose-lg"
        style={{
          fontSize: `${fontSize}px`,
          lineHeight,
          fontFamily: fontFamily === 'serif'
            ? "'Lora', Georgia, serif"
            : "'Inter', system-ui, sans-serif",
          color: 'inherit',
        }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  )
}
