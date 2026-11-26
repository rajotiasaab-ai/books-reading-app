import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BookFile, BookFormat } from '../utils/fileDetection'
import { saveBookFile, getBookFile, deleteBookFile } from '../utils/bookStorage'

export interface BookMeta {
  id: string
  name: string
  author?: string
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
  // In-memory map: id -> File (backed by IndexedDB for persistence across refreshes)
  fileMap: Record<string, File>
  addBook: (book: BookFile) => void
  removeBook: (id: string) => void
  updateProgress: (id: string, page: number, total: number) => void
  getFile: (id: string) => File | undefined
  loadFile: (id: string) => Promise<File | undefined>
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
          author: book.author,
          format: book.format,
          size: book.size,
          addedAt: book.addedAt,
          lastRead: book.lastRead,
          progress: book.progress,
          currentPage: book.currentPage,
          totalPages: book.totalPages,
          coverUrl: book.coverUrl,
        }
        void saveBookFile(book.id, book.file)
        set((s) => ({
          books: [meta, ...s.books.filter((b) => b.id !== book.id)],
          fileMap: { ...s.fileMap, [book.id]: book.file },
        }))
      },

      removeBook: (id) => {
        void deleteBookFile(id)
        set((s) => {
          const newFileMap = { ...s.fileMap }
          delete newFileMap[id]
          return {
            books: s.books.filter((b) => b.id !== id),
            fileMap: newFileMap,
          }
        })
      },

      updateProgress: (id, page, total) =>
        set((s) => ({
          books: s.books.map((b) =>
            b.id === id
              ? {
                  ...b,
                  currentPage: page,
                  totalPages: total,
                  progress: total > 0 ? Math.round((page / total) * 100) : 0,
                  lastRead: Date.now(),
                }
              : b
          ),
        })),

      getFile: (id) => get().fileMap[id],

      loadFile: async (id) => {
        const cached = get().fileMap[id]
        if (cached) return cached
        const stored = await getBookFile(id)
        if (stored) {
          set((s) => ({ fileMap: { ...s.fileMap, [id]: stored } }))
        }
        return stored
      },

      setSortBy: (sort) => set({ sortBy: sort }),
      setFilterFormat: (f) => set({ filterFormat: f }),
    }),
    {
      name: 'bookshelf-library',
      partialize: (state) => ({
        books: state.books,
        sortBy: state.sortBy,
        filterFormat: state.filterFormat,
      }),
    }
  )
)
