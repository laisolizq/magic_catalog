import '@testing-library/jest-dom/vitest'

// jsdom does not implement IntersectionObserver; provide a no-op stub
window.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof IntersectionObserver

window.matchMedia = window.matchMedia || function matchMedia() {
  return {
    matches: false,
    media: '',
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false
    },
  }
}

HTMLElement.prototype.scrollIntoView =
  HTMLElement.prototype.scrollIntoView ||
  function scrollIntoView() {}

window.scrollTo = function scrollTo() {}
