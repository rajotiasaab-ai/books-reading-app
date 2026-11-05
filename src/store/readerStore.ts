import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'sepia' | 'dark'

interface ReaderState {
  theme: Theme
  fontSize: number         // px, 14–28
  lineHeight: number       // 1.4–2.4
  fontFamily: 'serif' | 'sans'
  isFullscreen: boolean
  isSidebarOpen: boolean
  setTheme: (t: Theme) => void
  setFontSize: (n: number) => void
  setLineHeight: (n: number) => void
  setFontFamily: (f: 'serif' | 'sans') => void
  toggleFullscreen: () => void
  toggleSidebar: () => void
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      theme: 'dark',
      fontSize: 18,
      lineHeight: 1.8,
      fontFamily: 'serif',
      isFullscreen: false,
      isSidebarOpen: false,

      setTheme: (t) => set({ theme: t }),
      setFontSize: (n) => set({ fontSize: Math.min(28, Math.max(14, n)) }),
      setLineHeight: (n) => set({ lineHeight: Math.min(2.4, Math.max(1.4, n)) }),
      setFontFamily: (f) => set({ fontFamily: f }),
      toggleFullscreen: () => set((s) => ({ isFullscreen: !s.isFullscreen })),
      toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
    }),
    { name: 'bookshelf-reader-prefs' }
  )
)
