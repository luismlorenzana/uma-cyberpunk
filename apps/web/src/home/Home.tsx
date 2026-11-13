// Home (CY3): the game's name, the signed-in account, the save's sync state and revision, master data's release version,
// and Sync now. Master data proves the path only: nothing from it is drawn yet. The ship replaces it in CY10.
import { useAuth } from '@luismlorenzana/uma-kit/auth'
import { Button, Panel } from '@luismlorenzana/uma-kit/ui'
import type { ReactNode } from 'react'
import { useMaster } from '../master/master'
import { syncNow, useGame } from '../save/game'
import { shortTime, syncWords } from './sync-words'

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-hairline py-2 last:border-b-0">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right font-semibold">{children}</span>
    </div>
  )
}

export function Home() {
  const auth = useAuth()
  const game = useGame()
  const master = useMaster()
  const who = auth.user?.email ?? auth.user?.name ?? 'Local'
  const words = syncWords(game)
  return (
    <main className="pb-safe h-full overflow-y-auto bg-page px-4 py-6">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <h1 className="font-display text-center text-3xl font-bold tracking-tight">uma-cyberpunk</h1>
        <Panel>
          <Row label="Account">{who}</Row>
          <Row label="Save">{words === 'Synced' ? `Synced · ${shortTime(game.lastSyncedAt)}` : words}</Row>
          <Row label="Revision">{game.revision}</Row>
          <Row label="Master data">{master.status === 'ready' ? master.version : master.status === 'error' ? 'Unavailable' : 'Loading'}</Row>
        </Panel>
        <Button variant="secondary" disabled={game.sync === 'syncing'} onClick={() => void syncNow()}>Sync now</Button>
      </div>
    </main>
  )
}
