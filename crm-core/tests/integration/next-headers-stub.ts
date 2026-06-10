// In-memory `next/headers` stub for the integration test runner.
//
// Server actions call `cookies()` (via lib/auth/session-pin-lock + action-pin) and
// `headers()`. Outside a Next.js request scope those throw. This stub gives the
// node runner a working, request-free implementation so action tests can exercise
// the PIN gate. State is per-process; tests that assert on cookie contents mock
// `next/headers` themselves (see action-pin-rls.test.ts).
const store = new Map<string, string>()

export function cookies() {
  return {
    get: (name: string) => {
      const value = store.get(name)
      return value === undefined ? undefined : { name, value }
    },
    getAll: () => Array.from(store, ([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      store.set(name, value)
    },
    delete: (name: string) => {
      store.delete(name)
    },
    has: (name: string) => store.has(name),
  }
}

export function headers() {
  return new Headers()
}
