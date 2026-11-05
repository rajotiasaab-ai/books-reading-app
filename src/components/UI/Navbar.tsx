import { BookOpen, Library, Github } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const location = useLocation()
  const isViewer = location.pathname.startsWith('/read/')

  // In Apple Books style, the viewer has its own immersive floating controls
  if (isViewer) return null

  return (
    <header className="bg-gray-950/80 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center group-hover:bg-indigo-500 transition-colors">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white text-sm hidden sm:block">
              BookShelf
            </span>
          </Link>

          {/* Center — back to library when in reader */}
          {isViewer && (
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
            >
              <Library className="w-4 h-4" />
              <span>My Library</span>
            </Link>
          )}

          {/* Right */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 hidden md:block">
              🔒 Files never leave your device
            </span>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-sm"
              aria-label="GitHub"
            >
              <Github className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </header>
  )
}
