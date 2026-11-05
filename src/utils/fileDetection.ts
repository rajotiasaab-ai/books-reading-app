export type BookFormat = 'pdf' | 'epub' | 'txt' | 'md' | 'html' | 'cbz' | 'unknown'

export interface BookFile {
  id: string
  name: string
  format: BookFormat
  size: number
  file: File
  addedAt: number
  lastRead?: number
  progress: number      // 0–100
  currentPage: number
  totalPages: number
  coverUrl?: string
}

export function detectFormat(file: File): BookFormat {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mime = file.type.toLowerCase()

  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf'
  if (ext === 'epub' || mime === 'application/epub+zip') return 'epub'
  if (ext === 'txt' || mime === 'text/plain') return 'txt'
  if (ext === 'md' || mime === 'text/markdown') return 'md'
  if (ext === 'html' || ext === 'htm' || mime === 'text/html') return 'html'
  if (ext === 'cbz' || mime === 'application/zip') return 'cbz'
  return 'unknown'
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function getFormatColor(format: BookFormat): string {
  const colors: Record<BookFormat, string> = {
    pdf: 'bg-red-500/20 text-red-400 border-red-500/30',
    epub: 'bg-green-500/20 text-green-400 border-green-500/30',
    txt: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    md: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    html: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    cbz: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    unknown: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }
  return colors[format]
}

export const SUPPORTED_FORMATS = ['.pdf', '.epub', '.txt', '.md', '.html', '.htm', '.cbz']
export const ACCEPT_ATTR = SUPPORTED_FORMATS.join(',')
