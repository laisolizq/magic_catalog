import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

import { AppHeader } from '../../../../App/components/AppHeader/AppHeader'
import './CatalogChrome.css'

interface BasicCatalogChromeProps {
  children: ReactNode
}

export function BasicCatalogChrome({ children }: BasicCatalogChromeProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const contentHeightRef = useRef(0)
  const hiddenPxRef = useRef(0)
  const lastScrollYRef = useRef(0)
  const [isInteractive, setIsInteractive] = useState(true)

  // Applies the current hidden amount directly to the DOM (instead of via
  // React state) so the chrome tracks the scroll position 1:1, in the same
  // frame as the rest of the page - a CSS-transitioned/threshold-based
  // toggle would visibly lag behind the list's own scroll.
  const applyOffset = () => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    const hidden = hiddenPxRef.current
    outer.style.height = `${contentHeightRef.current - hidden}px`
    inner.style.transform = `translateY(-${hidden}px)`
    setIsInteractive(hidden < contentHeightRef.current)
  }

  useEffect(() => {
    const inner = innerRef.current
    if (!inner) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return

      contentHeightRef.current = entry.contentRect.height
      hiddenPxRef.current = Math.min(
        hiddenPxRef.current,
        contentHeightRef.current,
      )
      applyOffset()
    })
    observer.observe(inner)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    lastScrollYRef.current = window.scrollY

    let ticking = false
    const handleScroll = () => {
      if (ticking) return
      ticking = true

      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY
        const delta = currentScrollY - lastScrollYRef.current
        lastScrollYRef.current = currentScrollY

        hiddenPxRef.current =
          currentScrollY <= 0
            ? 0
            : Math.min(
                contentHeightRef.current,
                Math.max(0, hiddenPxRef.current + delta),
              )

        applyOffset()
        ticking = false
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div
      ref={outerRef}
      className="catalog-chrome catalog-basic-chrome"
      style={{ pointerEvents: isInteractive ? 'auto' : 'none' }}
    >
      <div
        className="catalog-chrome-inner"
        ref={innerRef}
      >
        <AppHeader isVisible />
        {children}
      </div>
    </div>
  )
}
