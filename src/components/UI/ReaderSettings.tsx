import React from 'react'
import {
  Sun,
  Moon,
  Coffee,
  Minus,
  Plus,
  Type,
  AlignJustify,
  Columns2,
  Maximize,
  Sparkles,
} from 'lucide-react'
import {
  useReaderStore,
  type AppleTheme,
  type BookFont,
  type PageSpread,
  type ReadingWidth,
} from '../../store/readerStore'
import clsx from 'clsx'

const themes: {
  value: AppleTheme
  label: string
  bg: string
  text: string
  border: string
  icon: React.ReactNode
}[] = [
  {
    value: 'light',
    label: 'White',
    bg: '#ffffff',
    text: '#1c1c1e',
    border: 'border-gray-300',
    icon: <Sun className="w-3.5 h-3.5 text-amber-500" />,
  },
  {
    value: 'sepia',
    label: 'Sepia',
    bg: '#fbf0d9',
    text: '#3d2b1f',
    border: 'border-amber-300/60',
    icon: <Coffee className="w-3.5 h-3.5 text-amber-700" />,
  },
  {
    value: 'slate',
    label: 'Slate',
    bg: '#242426',
    text: '#e5e5ea',
    border: 'border-zinc-700',
    icon: <Moon className="w-3.5 h-3.5 text-zinc-400" />,
  },
  {
    value: 'dark',
    label: 'Black',
    bg: '#000000',
    text: '#d1d1d6',
    border: 'border-zinc-800',
    icon: <Sparkles className="w-3.5 h-3.5 text-indigo-400" />,
  },
]

const fontOptions: { value: BookFont; label: string; family: string }[] = [
  { value: 'serif', label: 'Lora', family: "'Lora', Georgia, serif" },
  { value: 'merriweather', label: 'Merriweather', family: "'Merriweather', Georgia, serif" },
  { value: 'sans', label: 'Inter', family: "'Inter', system-ui, sans-serif" },
  { value: 'mono', label: 'Mono', family: "'JetBrains Mono', monospace" },
]

const widthOptions: { value: ReadingWidth; label: string; desc: string }[] = [
  { value: 'compact', label: 'Compact', desc: 'Optimal for phones & focused reading' },
  { value: 'normal', label: 'Standard', desc: 'Balanced for tablets & laptops' },
  { value: 'wide', label: 'Spacious', desc: 'Wider book area for large displays' },
  { value: 'full', label: 'Full', desc: 'Maximizes reading area across entire screen' },
]

export default function ReaderSettings() {
  const {
    theme,
    setTheme,
    fontSize,
    setFontSize,
    lineHeight,
    setLineHeight,
    fontFamily,
    setFontFamily,
    readingWidth,
    setReadingWidth,
    pageSpread,
    setPageSpread,
    brightness,
    setBrightness,
  } = useReaderStore()

  return (
    <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-700/70 rounded-2xl p-5 space-y-5 w-80 shadow-2xl text-white select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-800">
        <span className="text-xs font-semibold tracking-wider uppercase text-gray-400 flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5 text-amber-500" /> Book Appearance
        </span>
        <span className="text-[11px] text-amber-400 font-medium">Apple Books Style</span>
      </div>

      {/* Brightness */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
          <span className="flex items-center gap-1">
            <Sun className="w-3.5 h-3.5" /> Ambient Brightness
          </span>
          <span className="font-mono text-gray-300">{Math.round(brightness * 100)}%</span>
        </div>
        <input
          type="range"
          min={40}
          max={100}
          value={Math.round(brightness * 100)}
          onChange={(e) => setBrightness(Number(e.target.value) / 100)}
          className="w-full accent-amber-500 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
        />
      </div>

      {/* Themes */}
      <div>
        <label className="text-xs text-gray-400 mb-2 block font-medium">Theme</label>
        <div className="grid grid-cols-4 gap-2">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              style={{ backgroundColor: t.bg, color: t.text }}
              className={clsx(
                'flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] font-medium transition-all duration-200 border shadow-sm',
                t.border,
                theme === t.value
                  ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-gray-900 scale-105'
                  : 'opacity-70 hover:opacity-100 hover:scale-102'
              )}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
          <span>Text Size</span>
          <span className="font-mono text-gray-300">{fontSize}px</span>
        </div>
        <div className="flex items-center gap-3 bg-gray-800/80 p-1.5 rounded-xl border border-gray-700/50">
          <button
            onClick={() => setFontSize(fontSize - 1)}
            disabled={fontSize <= 13}
            className="p-1.5 text-gray-300 hover:text-white rounded-lg hover:bg-gray-700/70 disabled:opacity-30"
            aria-label="Decrease font size"
          >
            <Minus className="w-4 h-4" />
          </button>
          <input
            type="range"
            min={13}
            max={32}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="flex-1 accent-amber-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
          />
          <button
            onClick={() => setFontSize(fontSize + 1)}
            disabled={fontSize >= 32}
            className="p-1.5 text-gray-300 hover:text-white rounded-lg hover:bg-gray-700/70 disabled:opacity-30"
            aria-label="Increase font size"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Typography Fonts */}
      <div>
        <label className="text-xs text-gray-400 mb-2 block font-medium">Font Family</label>
        <div className="grid grid-cols-2 gap-1.5">
          {fontOptions.map((f) => (
            <button
              key={f.value}
              onClick={() => setFontFamily(f.value)}
              style={{ fontFamily: f.family }}
              className={clsx(
                'py-2 px-3 rounded-xl text-xs font-medium transition-all text-left truncate border',
                fontFamily === f.value
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-gray-800/60 text-gray-400 border-gray-700/40 hover:text-white hover:bg-gray-800'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Page Spread Layout (Single vs Two-Page) */}
      <div>
        <label className="text-xs text-gray-400 mb-2 block font-medium flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Columns2 className="w-3.5 h-3.5" /> Book Page Spread
          </span>
          <span className="text-[10px] text-gray-500 capitalize">{pageSpread} mode</span>
        </label>
        <div className="grid grid-cols-3 gap-1 bg-gray-800/70 p-1 rounded-xl border border-gray-700/50">
          {(['auto', 'single', 'double'] as PageSpread[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setPageSpread(mode)}
              className={clsx(
                'py-1.5 text-xs font-medium rounded-lg capitalize transition-all',
                pageSpread === mode
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              {mode === 'auto' ? 'Auto 📱💻' : mode === 'single' ? 'Single 📄' : '2-Pages 📖'}
            </button>
          ))}
        </div>
      </div>

      {/* Screen & Area Width (Responsive for Mobile, Tabs, PCs) */}
      <div>
        <label className="text-xs text-gray-400 mb-2 block font-medium flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Maximize className="w-3.5 h-3.5" /> Reading Area Width
          </span>
          <span className="text-[10px] text-amber-400/80 capitalize">{readingWidth}</span>
        </label>
        <div className="grid grid-cols-4 gap-1 bg-gray-800/70 p-1 rounded-xl border border-gray-700/50">
          {widthOptions.map((w) => (
            <button
              key={w.value}
              onClick={() => setReadingWidth(w.value)}
              title={w.desc}
              className={clsx(
                'py-1.5 text-[11px] font-medium rounded-lg transition-all',
                readingWidth === w.value
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Line Spacing */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
          <span className="flex items-center gap-1.5">
            <AlignJustify className="w-3.5 h-3.5" /> Line Spacing
          </span>
          <span className="font-mono text-gray-300">{lineHeight.toFixed(2)}</span>
        </div>
        <div className="grid grid-cols-3 gap-1 bg-gray-800/70 p-1 rounded-xl border border-gray-700/50">
          {[
            { val: 1.4, label: 'Tight' },
            { val: 1.75, label: 'Normal' },
            { val: 2.1, label: 'Relaxed' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => setLineHeight(item.val)}
              className={clsx(
                'py-1 text-xs font-medium rounded-lg transition-all',
                Math.abs(lineHeight - item.val) < 0.1
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
