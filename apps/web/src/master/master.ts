// Master data, as far as CY3 needs it: the release's version on Home, which proves the path from uma-platform's release
// through cyber-api's proxy (copied from uma-quest's at cc42fd1). Nothing from it is drawn yet.
import { useSyncExternalStore } from 'react'
import { CONTENT } from '../content/client'

export type MasterState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; version: string }
  | { status: 'error'; message: string; offline: boolean }

let state: MasterState = { status: 'idle' }
const listeners = new Set<() => void>()
function set(next: MasterState): void {
  state = next
  for (const listener of listeners) listener()
}

export function loadMaster(): void {
  if (state.status === 'loading' || state.status === 'ready') return
  set({ status: 'loading' })
  CONTENT.manifest().then(
    (manifest) => set({ status: 'ready', version: manifest.version }),
    (err: unknown) => set({
      status: 'error', message: err instanceof Error ? err.message : String(err),
      offline: typeof navigator !== 'undefined' && navigator.onLine === false,
    }),
  )
}

/** Try again after an error. */
export function retryMaster(): void {
  if (state.status === 'error') set({ status: 'idle' })
  loadMaster()
}

export function useMaster(): MasterState {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, () => state, () => state)
}
