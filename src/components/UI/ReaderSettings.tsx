import { Sun, Moon, Coffee, Minus, Plus, Type, AlignJustify } from 'lucide-react'
import { useReaderStore, type Theme } from '../../store/readerStore'
import clsx from 'clsx'

const themes: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
  { value: 'sepia', label: 'Sepia', icon: <Coffee className="w-4 h-4" /> },
  { value: 'dark',  label: 'Dark',  icon: <Moon className="w-4 h-4" /> },
]

export default function ReaderSettings() {
  const { theme, setTheme, fontSize, setFontSize, lineHeight, setLineHeight, fontFamily, setFontFamily } = useReaderStore()

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-5 w-64">
      {/* Theme */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Theme</label>
        <div className="grid grid-cols-3 gap-1">
          {themes.map(t => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={clsx(
                'flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-all',
                theme === t.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font size */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-1">
          <Type className="w-3 h-3" /> Font Size ({fontSize}px)
        </label>
        <div className="flex items-center gap-2">
          <button onClick={() => setFontSize(fontSize - 1)} className="btn-ghost p-1.5 rounded-lg">
            <Minus className="w-3 h-3" />
          </button>
          <input
            type="range" min={14} max={28} value={fontSize}
            onChange={e => setFontSize(Number(e.target.value))}
            className="flex-1 accent-indigo-500"
          />
          <button onClick={() => setFontSize(fontSize + 1)} className="btn-ghost p-1.5 rounded-lg">
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Line height */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-1">
          <AlignJustify className="w-3 h-3" /> Line Height ({lineHeight.toFixed(1)})
        </label>
        <input
          type="range" min={14} max={24} value={Math.round(lineHeight * 10)}
          onChange={e => setLineHeight(Number(e.target.value) / 10)}
          className="w-full accent-indigo-500"
        />
      </div>

      {/* Font family */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Font</label>
        <div className="grid grid-cols-2 gap-1">
          {(['serif', 'sans'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFontFamily(f)}
              className={clsx(
                'py-2 px-3 rounded-lg text-sm transition-all',
                f === 'serif' ? 'font-serif' : 'font-sans',
                fontFamily === f
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              {f === 'serif' ? 'Serif' : 'Sans'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
