import { useState, useEffect, useMemo, useRef } from 'react'
import { useReaderStore } from '../store/readerStore'

export interface ResponsiveBookInfo {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isLandscape: boolean
  isTwoPage: boolean
  containerWidthClass: string
  touchHandlers: {
    onTouchStart: (e: React.TouchEvent) => void
    onTouchMove: (e: React.TouchEvent) => void
    onTouchEnd: () => void
  }
}

export function useResponsiveBook(
  onPrevPage?: () => void,
  onNextPage?: () => void
): ResponsiveBookInfo {
  const { pageSpread, readingWidth } = useReaderStore()
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  })

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isMobile = windowSize.width < 768
  const isTablet = windowSize.width >= 768 && windowSize.width < 1024
  const isDesktop = windowSize.width >= 1024
  const isLandscape = windowSize.width > windowSize.height

  // Compute effective two-page spread
  const isTwoPage = useMemo(() => {
    if (pageSpread === 'single') return false
    if (pageSpread === 'double') return true
    // 'auto' mode: 2-page spread on desktop or tablet landscape
    return isDesktop || (isTablet && isLandscape)
  }, [pageSpread, isDesktop, isTablet, isLandscape])

  // Compute responsive reading width container
  const containerWidthClass = useMemo(() => {
    switch (readingWidth) {
      case 'compact':
        return 'max-w-2xl'
      case 'normal':
        return isTwoPage ? 'max-w-5xl' : 'max-w-3xl'
      case 'wide':
        return isTwoPage ? 'max-w-7xl' : 'max-w-4xl'
      case 'full':
        return 'max-w-[98%]'
      default:
        return 'max-w-5xl'
    }
  }, [readingWidth, isTwoPage])

  // Touch swipe detection for mobile & tablet
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    touchEndX.current = null
  }

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }

  const onTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return
    const diffX = touchStartX.current - touchEndX.current
    const minSwipeDistance = 50

    if (Math.abs(diffX) > minSwipeDistance) {
      if (diffX > 0) {
        // Swiped Left -> Next page
        onNextPage?.()
      } else {
        // Swiped Right -> Prev page
        onPrevPage?.()
      }
    }

    touchStartX.current = null
    touchStartY.current = null
    touchEndX.current = null
  }

  return {
    isMobile,
    isTablet,
    isDesktop,
    isLandscape,
    isTwoPage,
    containerWidthClass,
    touchHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  }
}
