// Copied from uma-farm's at a245a21 (itself uma-rpg's at 30a322a): renders its children once master data is loaded, else a
// loading line or "connect once".
import type { ReactNode } from 'react'
import { retryMaster, useMaster } from './master'

export function MasterGate({ children }: { children: ReactNode }) {
  const master = useMaster()
  if (master.status === 'ready') return <>{children}</>
  if (master.status === 'error')
    return (
      <div className="space-y-3 p-4">
        <p className="text-ink">{master.offline ? 'Connect once to download the game data.' : 'The game data could not be loaded.'}</p>
        <button type="button" onClick={retryMaster} className="min-h-11 rounded-sm bg-accent px-4 font-display font-bold text-accent-ink">
          Try again
        </button>
      </div>
    )
  return <p className="p-4 text-ink-soft">Loading game data…</p>
}
