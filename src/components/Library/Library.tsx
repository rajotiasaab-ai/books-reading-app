import { useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload,
  BookOpen,
  Grid3X3,
  List,
  Filter,
  Search,
  Sparkles,
  BookMarked,
} from 'lucide-react'
import { useLibraryStore } from '../../store/libraryStore'
import {
  detectFormat,
  generateId,
  ACCEPT_ATTR,
  type BookFormat,
} from '../../utils/fileDetection'
import BookCard from './BookCard'
import clsx from 'clsx'

const FORMAT_OPTIONS: { value: BookFormat | 'all'; label: string }[] = [
  { value: 'all', label: 'All Formats' },
  { value: 'pdf', label: 'PDF' },
  { value: 'epub', label: 'EPUB' },
  { value: 'txt', label: 'TXT' },
  { value: 'md', label: 'Markdown' },
  { value: 'html', label: 'HTML' },
]

// Built-in classic sample books for immediate test reading
const SAMPLE_BOOKS = [
  {
    name: 'The Art of War — Sun Tzu',
    format: 'txt' as BookFormat,
    content: `# The Art of War\n\n*By Sun Tzu*\n\n## Chapter 1: Laying Plans\n\nSun Tzu said: The art of war is of vital importance to the State.\n\nIt is a matter of life and death, a road either to safety or to ruin. Hence it is a subject of inquiry which can on no account be neglected.\n\nThe moral law causes the people to be in complete accord with their ruler, so that they will follow him regardless of their lives, undismayed by any danger.\n\nHeaven signifies night and day, cold and heat, times and seasons. Earth comprises distances, great and small; danger and security; open ground and narrow passes; the chances of life and death.\n\nThe Commander stands for the virtues of wisdom, sincerity, benevolence, courage, and strictness.\n\nBy method and discipline are to be understood the marshaling of the army in its proper subdivisions, the graduations of rank among the officers, the maintenance of roads by which supplies may reach the army, and the control of military expenditure.\n\n## Chapter 2: Waging War\n\nSun Tzu said: In the operations of war, where there are in the field a thousand swift chariots, as many heavy chariots, and a hundred thousand mail-clad soldiers, with provisions enough to carry them a thousand li, the expenditure at home and at the front, including entertainment of guests, small items such as glue and paint, and sums spent on chariots and armor, will reach the total of a thousand ounces of silver per day. Such is the cost of raising an army of 100,000 men.\n\nWhen you engage in actual fighting, if victory is long in coming, then men's weapons will grow dull and their ardor will be damped. If you lay siege to a town, you will exhaust your strength.\n\nAgain, if the campaign is protracted, the resources of the State will not be equal to the strain.\n\nNow, when your weapons are dulled, your ardor damped, your strength exhausted and your treasure spent, other chieftains will spring up to take advantage of your extremity. Then no man, however wise, will be able to avert the consequences that must ensue.\n\nThus, though we have heard of stupid haste in war, cleverness has never been seen associated with long delays.\n\nThere is no instance of a country having benefited from prolonged warfare.`,
  },
  {
    name: 'Alice in Wonderland — Lewis Carroll',
    format: 'md' as BookFormat,
    content: `# Alice's Adventures in Wonderland\n\n*By Lewis Carroll*\n\n## CHAPTER I. Down the Rabbit-Hole\n\nAlice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”\n\nSo she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.\n\nThere was nothing so VERY remarkable in that; nor did Alice think it so VERY much out of the way to hear the Rabbit say to itself, “Oh dear! Oh dear! I shall be late!” (when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); but when the Rabbit actually TOOK A WATCH OUT OF ITS WAISTCOAT-POCKET, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge.\n\nIn another moment down went Alice after it, never once considering in the world how she was to get out again.\n\nThe rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so suddenly that Alice had not a moment to think about stopping herself before she found herself falling down a very deep well.\n\nEither the well was very deep, or she fell very slowly, for she had plenty of time as she went down to look about her and to wonder what was going to happen next. First, she tried to look down and make out what she was coming to, but it was too dark to see anything; then she looked at the sides of the well, and noticed that they were filled with cupboards and book-shelves; here and there she saw maps and pictures hung upon pegs. She took down a jar from one of the shelves as she passed; it was labelled “ORANGE MARMALADE”, but to her great disappointment it was empty: she did not like to drop the jar for fear of killing somebody, so managed to put it into one of the cupboards as she fell past it.`,
  },
]

export default function Library() {
  const navigate = useNavigate()
  const {
    books,
    addBook,
    removeBook,
    sortBy,
    setSortBy,
    filterFormat,
    setFilterFormat,
  } = useLibraryStore()

  const [isDragging, setIsDragging] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((file) => {
        const format = detectFormat(file)
        if (format === 'unknown') return
        addBook({
          id: generateId(),
          name: file.name.replace(/\.[^.]+$/, ''),
          format,
          size: file.size,
          file,
          addedAt: Date.now(),
          progress: 0,
          currentPage: 1,
          totalPages: 0,
        })
      })
    },
    [addBook]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      processFiles(e.dataTransfer.files)
    },
    [processFiles]
  )

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const onDragLeave = () => setIsDragging(false)

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files)
    e.target.value = ''
  }

  // Load sample book into library
  const loadSampleBook = (sample: typeof SAMPLE_BOOKS[0]) => {
    const blob = new Blob([sample.content], { type: 'text/plain' })
    const sampleFile = new File([blob], `${sample.name}.${sample.format}`, {
      type: 'text/plain',
    })
    const id = generateId()
    addBook({
      id,
      name: sample.name,
      format: sample.format,
      size: blob.size,
      file: sampleFile,
      addedAt: Date.now(),
      progress: 0,
      currentPage: 1,
      totalPages: 0,
    })
    navigate(`/read/${id}`)
  }

  const filteredBooks = useMemo(() => {
    return [...books]
      .filter((b) => filterFormat === 'all' || b.format === filterFormat)
      .filter(
        (b) =>
          !searchQuery.trim() ||
          b.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name)
        if (sortBy === 'lastRead') return (b.lastRead ?? 0) - (a.lastRead ?? 0)
        if (sortBy === 'progress') return b.progress - a.progress
        return b.addedAt - a.addedAt
      })
  }, [books, filterFormat, searchQuery, sortBy])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 select-none">
      {/* 🍏 Apple Books Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white tracking-tight">
              My Bookshelf
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Apple Books Flow
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            {books.length} book{books.length !== 1 ? 's' : ''} in library · PDF, EPUB, TXT, Markdown, HTML
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your library…"
            className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/60 transition-colors"
          />
        </div>
      </div>

      {/* 🍏 Apple Style Drag & Drop Zone */}
      <div
        className={clsx(
          'drop-zone mb-8 group relative overflow-hidden backdrop-blur-md',
          isDragging && 'drag-over'
        )}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center gap-3 pointer-events-none relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Upload className="w-8 h-8 text-amber-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-lg">Drop your books here</p>
            <p className="text-gray-400 text-sm mt-1">
              Supports <strong>PDF, EPUB, TXT, Markdown, and HTML</strong> · Stored 100% locally on your device
            </p>
          </div>
          <span
            className="btn-primary text-sm pointer-events-auto mt-1"
            onClick={(e) => {
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
          >
            <BookOpen className="w-4 h-4" /> Choose Books from Device
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          onChange={onFileInput}
          className="hidden"
        />
      </div>

      {/* Quick Sample Books Section (For instant testing) */}
      {books.length === 0 && (
        <div className="mb-10 p-6 rounded-3xl bg-gradient-to-r from-amber-950/30 via-gray-900 to-gray-900 border border-amber-500/20 shadow-xl">
          <div className="flex items-center gap-2 mb-2 text-amber-400">
            <Sparkles className="w-4 h-4" />
            <h2 className="text-sm font-semibold uppercase tracking-wider">
              Instant Preview Classics
            </h2>
          </div>
          <p className="text-xs text-gray-400 mb-4 max-w-xl">
            Don't have a book handy? Tap one of these public domain classics to test the realistic 2-page Apple Books reader immediately:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SAMPLE_BOOKS.map((s, idx) => (
              <div
                key={idx}
                onClick={() => loadSampleBook(s)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 hover:border-amber-500/40 cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-12 rounded-lg bg-amber-900/60 border border-amber-500/30 flex items-center justify-center">
                    <BookMarked className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white group-hover:text-amber-400 transition-colors">
                      {s.name}
                    </h3>
                    <span className="text-[10px] uppercase font-mono text-gray-400">
                      {s.format} · Click to read
                    </span>
                  </div>
                </div>
                <span className="text-xs text-amber-400 group-hover:translate-x-1 transition-transform font-medium">
                  Read →
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and View Controls */}
      {books.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-6 bg-gray-900/60 p-2 rounded-2xl border border-gray-800">
          {/* Format Chips */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400 ml-2" />
            <select
              value={filterFormat}
              onChange={(e) => setFilterFormat(e.target.value as BookFormat | 'all')}
              className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
            >
              {FORMAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Menu */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
          >
            <option value="addedAt">Recently Added</option>
            <option value="lastRead">Recently Read</option>
            <option value="name">Title A–Z</option>
            <option value="progress">Reading Progress</option>
          </select>

          {/* Grid / List view toggle */}
          <div className="ml-auto flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={clsx(
                'p-1.5 rounded-lg transition-colors',
                viewMode === 'grid'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              )}
              title="Grid view"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                'p-1.5 rounded-lg transition-colors',
                viewMode === 'list'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              )}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 🍏 Responsive Book Grid: 2 cols on mobile, 3-4 on tablet, 5-6 on desktop */}
      {filteredBooks.length > 0 ? (
        <div
          className={clsx(
            viewMode === 'grid'
              ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 sm:gap-6'
              : 'flex flex-col gap-3'
          )}
        >
          {filteredBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              viewMode={viewMode}
              onOpen={() => navigate(`/read/${book.id}`)}
              onRemove={() => removeBook(book.id)}
            />
          ))}
        </div>
      ) : books.length > 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-base font-medium">No books match "{searchQuery}"</p>
          <p className="text-xs text-gray-500 mt-1">Try clearing your search query or format filter.</p>
        </div>
      ) : null}
    </div>
  )
}
