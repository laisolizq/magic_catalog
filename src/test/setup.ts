import '@testing-library/jest-dom/vitest'

// jsdom does not implement IntersectionObserver; provide a no-op stub
window.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof IntersectionObserver
