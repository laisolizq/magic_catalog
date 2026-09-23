import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  captureViewportCardAnchor,
  restoreViewportCardAnchor,
} from './viewportCardAnchor'

function cardTile(top: number, height: number): HTMLElement {
  const element = document.createElement('article')
  element.className = 'card-tile'
  element.dataset.cardId = String(top)
  element.getBoundingClientRect = () => ({
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 100,
    width: 100,
    x: 0,
    y: top,
    toJSON: () => ({}),
  })
  document.body.append(element)
  return element
}

describe('viewport card anchoring', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('captures the visible card nearest the viewport center', () => {
    vi.stubGlobal('innerHeight', 800)
    cardTile(-300, 100)
    const nearestCard = cardTile(330, 120)
    cardTile(600, 100)

    expect(captureViewportCardAnchor()).toEqual({
      element: nearestCard,
      top: 330,
    })
  })

  it('restores the anchored card to its previous viewport offset', () => {
    const anchoredCard = cardTile(460, 100)
    anchoredCard.getBoundingClientRect = () => ({
      top: 590,
      bottom: 690,
      height: 100,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: 590,
      toJSON: () => ({}),
    })
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})

    restoreViewportCardAnchor({ element: anchoredCard, top: 460 })

    expect(scrollBy).toHaveBeenCalledWith({ top: 130, behavior: 'instant' })
  })
})