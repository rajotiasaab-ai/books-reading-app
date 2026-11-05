import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BookFile, BookFormat } from '../utils/fileDetection'

// We store metadata only in Zustand/localStorage (not the File object itself)
export interface BookMeta {
  id: string
  name: string
  format: BookFormat
  size: number
  addedAt: number
  lastRead?: number
  progress: number
  currentPage: number
  totalPages: number
  coverUrl?: string
}

interface LibraryState {
  books: BookMeta[]
  // In-memory map: id -> File (not persisted)
  fileMap: Record<string, File>
  addBook: (book: BookFile) => void
  removeBook: (id: string) => void
  updateProgress: (id: string, page: number, total: number) => void
  getFile: (id: string) => File | undefined
  sortBy: 'addedAt' | 'lastRead' | 'name' | 'progress'
  setSortBy: (sort: LibraryState['sortBy']) => void
  filterFormat: BookFormat | 'all'
  setFilterFormat: (f: LibraryState['filterFormat']) => void
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      books: [],
      fileMap: {},
      sortBy: 'addedAt',
      filterFormat: 'all',

      addBook: (book) => {
        const meta: BookMeta = {
          id: book.id,
          name: book.name,
          format: book.format,
          size: book.size,
          addedAt: book.addedAt,
          lastRead: book.lastRead,
          progress: book.progress,
          currentPage: book.currentPage,
          totalPages: book.totalPages,
          coverUrl: book.coverUrl,
        }
        set((s) => ({
          books: [meta, ...s.books.filter(b => b.id !== book.id)],
          fileMap: { ...s.fileMap, [book.id]: book.file },
        }))
      },

      removeBook: (id) =>
        set((s) => {
          const newFileMap = { ...s.fileMap }
          delete newFileMap[id]
          return {
            books: s.books.filter(b => b.id !== id),
            fileMap: newFileMap,
          }
        }),

      updateProgress: (id, page, total) =>
        set((s) => ({
          books: s.books.map(b =>
            b.id === id
              ? { ...b, currentPage: page, totalPages: total, progress: total > 0 ? Math.round((page / total) * 100) : 0, lastRead: Date.now() }
              : b
          ),
        })),

      getFile: (id) => get().fileMap[id],

      setSortBy: (sort) => set({ sortBy: sort }),
      setFilterFormat: (f) => set({ filterFormat: f }),
    }),
    {
      name: 'bookshelf-library',
      // Only persist metadata, not files
      partialize: (state) => ({
        books: state.books,
        sortBy: state.sortBy,
        filterFormat: state.filterFormat,
      }),
    }
  )
)
