import { useEffect, useState } from 'react'
import { Play, Pause, Square, Volume2, X } from 'lucide-react'
import { useReaderStore } from '../../store/readerStore'

interface Props {
  getTextToRead: () => string
  onClose: () => void
}

export default function TtsBar({ getTextToRead, onClose }: Props) {
  const { ttsRate, setTtsRate, isTtsPlaying, setIsTtsPlaying } = useReaderStore()
  const [synth, setSynth] = useState<SpeechSynthesis | null>(null)
  const [currentUtterance, setCurrentUtterance] = useState<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSynth(window.speechSynthesis)
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        setIsTtsPlaying(false)
      }
    }
  }, [setIsTtsPlaying])

  const speak = () => {
    if (!synth) return

    if (synth.paused) {
      synth.resume()
      setIsTtsPlaying(true)
      return
    }

    synth.cancel()
    const rawText = getTextToRead()
    // Clean up html tags or extra whitespace
    const cleanText = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    if (!cleanText) return

    const utter = new SpeechSynthesisUtterance(cleanText)
    utter.rate = ttsRate
    utter.onend = () => {
      setIsTtsPlaying(false)
    }
    utter.onerror = () => {
      setIsTtsPlaying(false)
    }

    setCurrentUtterance(utter)
    synth.speak(utter)
    setIsTtsPlaying(true)
  }

  const pause = () => {
    if (!synth) return
    synth.pause()
    setIsTtsPlaying(false)
  }

  const stop = () => {
    if (!synth) return
    synth.cancel()
    setIsTtsPlaying(false)
  }

  const changeRate = (rate: number) => {
    setTtsRate(rate)
    if (isTtsPlaying && currentUtterance && synth) {
      synth.cancel()
      const rawText = getTextToRead()
      const cleanText = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const utter = new SpeechSynthesisUtterance(cleanText)
      utter.rate = rate
      utter.onend = () => setIsTtsPlaying(false)
      setCurrentUtterance(utter)
      synth.speak(utter)
    }
  }

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-gray-900/95 backdrop-blur-xl border border-gray-700/80 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-4 text-white animate-slide-up select-none max-w-sm sm:max-w-md w-[92%] sm:w-auto justify-between">
      <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
        <Volume2 className="w-4 h-4 animate-pulse" />
        <span className="hidden sm:inline">Read Aloud</span>
      </div>

      <div className="flex items-center gap-2">
        {isTtsPlaying ? (
          <button
            onClick={pause}
            className="p-2.5 bg-amber-500 text-gray-950 rounded-xl hover:bg-amber-400 font-bold active:scale-95 transition-all shadow-md"
            title="Pause narration"
          >
            <Pause className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={speak}
            className="p-2.5 bg-amber-500 text-gray-950 rounded-xl hover:bg-amber-400 font-bold active:scale-95 transition-all shadow-md"
            title="Start reading aloud"
          >
            <Play className="w-4 h-4 fill-gray-950 ml-0.5" />
          </button>
        )}

        <button
          onClick={stop}
          className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          title="Stop narration"
        >
          <Square className="w-4 h-4" />
        </button>
      </div>

      {/* Speed switcher */}
      <div className="flex items-center gap-1 bg-gray-800/80 p-1 rounded-xl border border-gray-700/50">
        {[0.75, 1.0, 1.25, 1.5].map((r) => (
          <button
            key={r}
            onClick={() => changeRate(r)}
            className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-all ${
              ttsRate === r
                ? 'bg-amber-500 text-gray-950 font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {r}x
          </button>
        ))}
      </div>

      <button
        onClick={() => {
          stop()
          onClose()
        }}
        className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors ml-1"
        title="Close reader"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
