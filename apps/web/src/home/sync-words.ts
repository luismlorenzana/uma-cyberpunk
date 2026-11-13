import type { GameState } from '../save/game'

/** The save's state in a few words, for Home and Account (as uma-farm's). */
export function syncWords(state: Pick<GameState, 'sync' | 'dirty' | 'revision'>): string {
  if (state.sync === 'syncing') return 'Syncing'
  if (state.sync === 'offline') return state.dirty ? 'Offline · saved on this phone' : 'Offline'
  if (state.sync === 'error') return state.dirty ? 'Not backed up · saved on this phone' : 'Sync paused'
  if (state.dirty || state.revision === 0) return 'Saved on this phone'
  return 'Synced'
}

/** "12:05" today, else the date. */
export function shortTime(iso: string | null, now = new Date()): string {
  if (!iso) return 'Never'
  const at = new Date(iso)
  return at.toDateString() === now.toDateString()
    ? at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : at.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
