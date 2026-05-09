import { useRef, useState, useEffect, useCallback, Children, isValidElement } from 'react'
import { cn } from '../../lib/utils'

const SCROLL_DURATION_MS = 420

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** ease-out cubic — 점 클릭 시 부드럽게 감속 */
function smoothScrollElementTo(element, targetLeft, durationMs, rafRef) {
  if (!element) return
  if (rafRef.current != null) {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }
  if (prefersReducedMotion()) {
    element.scrollLeft = targetLeft
    return
  }
  const start = element.scrollLeft
  const distance = targetLeft - start
  if (Math.abs(distance) < 0.5) return
  const easeOutCubic = (t) => 1 - (1 - t) ** 3
  const t0 = performance.now()

  const step = (now) => {
    const elapsed = now - t0
    const t = Math.min(1, elapsed / durationMs)
    element.scrollLeft = start + distance * easeOutCubic(t)
    if (t < 1) {
      rafRef.current = requestAnimationFrame(step)
    } else {
      rafRef.current = null
    }
  }
  rafRef.current = requestAnimationFrame(step)
}

/**
 * 가로 스와이프 + 스냅 + 점 인디케이터로 매치업 카드 탐색
 * (점 클릭: ease-out 커스텀 스크롤 / 트랙: scroll-behavior + 스냅 패딩)
 */
export function MatchupCarousel({ children, className, dotTone = 'emerald' }) {
  const scrollRef = useRef(null)
  const scrollAnimRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const items = Children.toArray(children).filter(isValidElement)
  const count = items.length

  const updateActiveFromScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || count === 0) return
    const slides = el.querySelectorAll('[data-carousel-slide]')
    if (slides.length === 0) return
    const elRect = el.getBoundingClientRect()
    const centerX = elRect.left + elRect.width / 2
    let bestIdx = 0
    let bestDist = Infinity
    slides.forEach((slide, i) => {
      const r = slide.getBoundingClientRect()
      const slideCenter = r.left + r.width / 2
      const d = Math.abs(slideCenter - centerX)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    })
    setActiveIndex((prev) => (prev === bestIdx ? prev : bestIdx))
  }, [count])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateActiveFromScroll, { passive: true })
    updateActiveFromScroll()
    window.addEventListener('resize', updateActiveFromScroll)
    return () => {
      el.removeEventListener('scroll', updateActiveFromScroll)
      window.removeEventListener('resize', updateActiveFromScroll)
      if (scrollAnimRef.current != null) {
        cancelAnimationFrame(scrollAnimRef.current)
        scrollAnimRef.current = null
      }
    }
  }, [updateActiveFromScroll, count])

  const goTo = (i) => {
    const el = scrollRef.current
    const slide = el?.querySelector(`[data-carousel-slide="${i}"]`)
    if (!el || !slide) return
    const targetLeft = slide.offsetLeft
    smoothScrollElementTo(el, targetLeft, SCROLL_DURATION_MS, scrollAnimRef)
  }

  const showDots = count > 1

  return (
    <div className={cn('relative -mx-4 overflow-hidden', className)}>
      <div
        ref={scrollRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="매치업 슬라이드"
        className="matchup-carousel-track flex gap-4 overflow-x-auto overflow-y-hidden pb-2 px-4 snap-x snap-mandatory touch-pan-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {items.map((child, i) => (
          <div
            key={child.key ?? `carousel-${i}`}
            data-carousel-slide={i}
            className="w-[min(280px,85vw)] min-w-[240px] shrink-0 snap-start sm:min-w-[280px]"
          >
            {child}
          </div>
        ))}
      </div>

      {showDots && (
        <div
          className="flex justify-center items-center gap-1.5 mt-3 px-4"
          role="tablist"
          aria-label="슬라이드 위치"
        >
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={activeIndex === i}
              aria-label={`${i + 1}번째 매치업 보기`}
              onClick={() => goTo(i)}
              className="p-2 -m-0.5 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
            >
              <span
                className={cn(
                  'block h-1.5 rounded-full transition-all duration-500 ease-out motion-reduce:duration-150',
                  activeIndex === i
                    ? cn(
                        'w-5',
                        dotTone === 'violet' ? 'bg-violet-500' : 'bg-emerald-500'
                      )
                    : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
