export interface ViewportCardAnchor {
  element: HTMLElement
  top: number
}

export function captureViewportCardAnchor(): ViewportCardAnchor | null {
  const viewportCenter = window.innerHeight / 2
  let closestElement: HTMLElement | null = null
  let closestTop = 0
  let closestDistance = Number.POSITIVE_INFINITY

  document
    .querySelectorAll<HTMLElement>('.card-tile[data-card-id]')
    .forEach((element) => {
      const bounds = element.getBoundingClientRect()
      if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) return

      const distance = Math.abs(bounds.top + bounds.height / 2 - viewportCenter)
      if (distance >= closestDistance) return

      closestElement = element
      closestTop = bounds.top
      closestDistance = distance
    })

  return closestElement
    ? { element: closestElement, top: closestTop }
    : null
}

export function restoreViewportCardAnchor(
  anchor: ViewportCardAnchor | null,
): void {
  if (!anchor?.element.isConnected) return

  const topDelta = anchor.element.getBoundingClientRect().top - anchor.top
  if (topDelta === 0) return

  window.scrollBy({ top: topDelta, behavior: 'instant' })
}