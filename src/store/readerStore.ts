import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AppleTheme = 'light' | 'sepia' | 'slate' | 'dark'
export type BookFont = 'serif' | 'sans' | 'merriweather' | 'mono'
export type ReadingWidth = 'compact' | 'normal' | 'wide' | 'full'
export type PageSpread = 'auto' | 'single' | 'double'

export interface Bookmark {
  id: string
  bookId: string
  page: number
  title?: string
  snippet?: string
  createdAt: number
}

interface ReaderState {
  // Theme & Typography
  theme: AppleTheme
  fontSize: number           // px: 14 to 32
  lineHeight: number         // 1.3 to 2.4
  fontFamily: BookFont
  readingWidth: ReadingWidth // Area adjustment for different devices
  pageSpread: PageSpread     // Single vs Double page spread

  // Viewer Controls & UI
  showControls: boolean      // Toggle immersion mode on tap
  isFullscreen: boolean
  brightness: number         // 0.5 to 1.0

  // Bookmarks
  bookmarks: Bookmark[]
  addBookmark: (bookmark: Omit<Bookmark, 'id' | 'createdAt'>) => void
  removeBookmark: (id: string) => void
  isBookmarked: (bookId: string, page: number) => boolean

  // Text-To-Speech (Read Aloud)
  ttsRate: number
  isTtsPlaying: boolean

  // Setters
  setTheme: (t: AppleTheme) => void
  setFontSize: (n: number) => void
  setLineHeight: (n: number) => void
  setFontFamily: (f: BookFont) => void
  setReadingWidth: (w: ReadingWidth) => void
  setPageSpread: (p: PageSpread) => void
  setShowControls: (show: boolean) => void
  toggleControls: () => void
  toggleFullscreen: () => void
  setBrightness: (b: number) => void
  setTtsRate: (r: number) => void
  setIsTtsPlaying: (p: boolean) => void
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set, get) => ({
      theme: 'sepia',
      fontSize: 18,
      lineHeight: 1.75,
      fontFamily: 'serif',
      readingWidth: 'normal',
      pageSpread: 'auto',
      showControls: true,
      isFullscreen: false,
      brightness: 1.0,
      bookmarks: [],
      ttsRate: 1.0,
      isTtsPlaying: false,

      setTheme: (t) => set({ theme: t }),
      setFontSize: (n) => set({ fontSize: Math.min(32, Math.max(13, n)) }),
      setLineHeight: (n) => set({ lineHeight: Math.min(2.4, Math.max(1.3, n)) }),
      setFontFamily: (f) => set({ fontFamily: f }),
      setReadingWidth: (w) => set({ readingWidth: w }),
      setPageSpread: (p) => set({ pageSpread: p }),
      setShowControls: (show) => set({ showControls: show }),
      toggleControls: () => set((s) => ({ showControls: !s.showControls })),
      toggleFullscreen: () => set((s) => ({ isFullscreen: !s.isFullscreen })),
      setBrightness: (b) => set({ brightness: Math.min(1.0, Math.max(0.4, b)) }),
      setTtsRate: (r) => set({ ttsRate: r }),
      setIsTtsPlaying: (p) => set({ isTtsPlaying: p }),

      addBookmark: (b) => {
        const id = `${b.bookId}-${b.page}-${Date.now()}`
        set((s) => ({
          bookmarks: [
            ...s.bookmarks.filter((item) => !(item.bookId === b.bookId && item.page === b.page)),
            { ...b, id, createdAt: Date.now() },
          ],
        }))
      },

      removeBookmark: (id) =>
        set((s) => ({
          bookmarks: s.bookmarks.filter((b) => b.id !== id),
        })),

      isBookmarked: (bookId, page) =>
        get().bookmarks.some((b) => b.bookId === bookId && b.page === page),
    }),
    {
      name: 'bookshelf-apple-reader-prefs',
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        lineHeight: state.lineHeight,
        fontFamily: state.fontFamily,
        readingWidth: state.readingWidth,
        pageSpread: state.pageSpread,
        brightness: state.brightness,
        bookmarks: state.bookmarks,
        ttsRate: state.ttsRate,
      }),
    }
  )
)
