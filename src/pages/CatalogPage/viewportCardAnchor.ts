export interface ViewportCardAnchor {
  element: HTMLElement
  top: number
}

export function captureViewportCardAnchor(): ViewportCardAnchor | null {
  const elements = document.querySelectorAll<HTMLElement>('.card-tile[data-card-id]')

  // Anchor to the first visible card (in document order) so expanding/collapsing
  // grows the layout from the top of the viewport instead of its center.
  for (const element of elements) {
    const bounds = element.getBoundingClientRect()
    if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) continue

    return { element, top: bounds.top }
  }

  return null
}

export function restoreViewportCardAnchor(
  anchor: ViewportCardAnchor | null,
): void {
  if (!anchor?.element.isConnected) return

  const topDelta = anchor.element.getBoundingClientRect().top - anchor.top
  if (topDelta === 0) return

  window.scrollBy({ top: topDelta, behavior: 'instant' })
}