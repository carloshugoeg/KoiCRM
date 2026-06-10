// Empty stub for the `server-only` package in the integration test runner.
//
// `server-only` throws unless the bundler resolves its `react-server` export
// condition. Vitest's node runner doesn't set that condition, so importing any
// module that does `import "server-only"` (e.g. lib/auth/action-pin.ts) blows up
// at import time. The integration config aliases `server-only` to this no-op.
export {}
