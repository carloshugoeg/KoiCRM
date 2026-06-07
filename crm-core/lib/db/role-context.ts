import { AsyncLocalStorage } from "async_hooks"

/**
 * Marks a scope where SET ROLE / SET LOCAL ROLE was already applied.
 * Imported only from server modules (e.g. lib/db/rls.ts), never from lib/db/client.ts.
 */
const roleContext = new AsyncLocalStorage<{ established: true }>()

export function runWithEstablishedRole<T>(fn: () => T): T {
  return roleContext.run({ established: true }, fn)
}

export function runWithEstablishedRoleAsync<T>(fn: () => Promise<T>): Promise<T> {
  return roleContext.run({ established: true }, fn)
}

export function isRoleEstablished(): boolean {
  return roleContext.getStore()?.established === true
}
