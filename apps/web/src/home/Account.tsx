// Account (CY3, as uma-farm's AccountView): who's signed in, the save's state, Sync now, the device's safety copies with a
// Restore each, and sign-out.
import { useAuth } from '@luismlorenzana/uma-kit/auth'
import { Button, Panel } from '@luismlorenzana/uma-kit/ui'
import { useEffect, useState } from 'react'
import { safetyCopies, type SafetyCopy, type SafetyReason } from '../save/db'
import { restoreSafetyCopy, seeReplaced, syncNow, useGame } from '../save/game'
import { Row } from './Home'
import { shortTime, syncWords } from './sync-words'

const REASON: Record<SafetyReason, string> = { replaced: 'Replaced by a newer save', restore: 'Before a restore', unreadable: 'Couldn’t be read' }

export function Account() {
  const auth = useAuth()
  const game = useGame()
  const [copies, setCopies] = useState<SafetyCopy[]>([])
  const uid = game.uid
  useEffect(() => {
    if (uid) void safetyCopies(uid).then(setCopies)
  }, [uid, game.revision])
  useEffect(() => seeReplaced(), [])
  const who = auth.user?.email ?? auth.user?.name ?? 'Local'
  return (
    <main className="pb-safe h-full overflow-y-auto bg-page px-4 py-6">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <h1 className="font-display text-2xl font-bold">Account</h1>
        <Panel>
          <Row label="Signed in">{who}</Row>
          <Row label="Save">{syncWords(game)}</Row>
          <Row label="Last backed up">{shortTime(game.lastSyncedAt)}</Row>
        </Panel>
        <Button variant="secondary" disabled={game.sync === 'syncing'} onClick={() => void syncNow()}>Sync now</Button>
        <h2 className="font-display text-lg font-bold">Safety copies</h2>
        {copies.length === 0 ? <p className="text-ink-soft">None on this phone.</p> : (
          <Panel>
            {copies.map((copy) => (
              <div key={copy.id} className="flex min-h-11 items-center justify-between gap-3 border-b border-hairline py-2 last:border-b-0">
                <span><span className="font-semibold">{REASON[copy.reason]}</span> <span className="text-ink-soft">· {shortTime(copy.at)}</span></span>
                <Button size="sm" variant="secondary" onClick={() => {
                  if (copy.id !== undefined && uid) void restoreSafetyCopy(copy.id).then(() => safetyCopies(uid)).then(setCopies)
                }}>Restore</Button>
              </div>
            ))}
          </Panel>
        )}
        {auth.authRequired && <Button variant="secondary" onClick={() => void auth.signOut()}>Sign out</Button>}
      </div>
    </main>
  )
}
