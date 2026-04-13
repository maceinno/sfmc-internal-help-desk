// Only load jest-dom matchers when running in a DOM environment (jsdom/happy-dom).
// Pure-node unit tests don't have a DOM and jest-dom will throw because `expect`
// is not yet extended with DOM matchers at import time.
if (typeof globalThis.document !== 'undefined') {
  await import('@testing-library/jest-dom')
}

export {}
