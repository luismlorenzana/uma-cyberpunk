// The ship (CY10, CY15, TC9, TC49, TC62): the hub every session starts and ends in. A side cutaway of the decks the player
// builds (`Hull.tsx`): a tap on a module opens its quick look (Enter, Upgrade, Research), a tap on an empty slot the build
// sheet; the wallet and the reactor's pips sit in the header. A Continue card says what's waiting. Landscape, on the turned stage. When the app opens with a mission in progress, it
// goes straight back to it (resume anywhere); a new game goes straight to its first scene (CY12, TC36); a finished
// chapter's debrief plays here, aboard.
import { fillCaptain } from '@cyber/domain'
import { TurnedStage } from '@luismlorenzana/uma-stage'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { messageFor } from '../bonds/messages'
import { replyTo, settleBonds } from '../bonds/bonds'
import { CaptainSetup } from '../captain/CaptainSetup'
import { applyStep, debriefDue, debriefScene, ensureWorld, markSeen, opening, sceneSquad, waiting } from '../mission/director'
import { updateSave, useGame } from '../save/game'
import { ScenePlayer } from '../story/ScenePlayer'
import { useCrew } from '../crew/useCrew'
import { Decks, WalletChips } from './Hull'
import { EventCard, LogCard } from './ShipCards'

const DutiesPanel = lazy(() => import('./DutiesPanel'))
import { outfitName, useStory } from './useStory'

let resumedThisLoad = false

export default function ShipScreen() {
  return <TurnedStage>{() => <Ship />}</TurnedStage>
}

function Ship() {
  const navigate = useNavigate()
  const save = useGame((g) => g.save)
  const pack = useStory()
  const [menu, setMenu] = useState(false)
  const [inbox, setInbox] = useState(false)
  const [duties, setDuties] = useState(false)
  const { crew } = useCrew()

  useEffect(() => {
    if (!save || !pack) return
    if (Object.keys(save.worlds.known).length === 0 && pack.casting.leads[0]) { void updateSave((s) => ensureWorld(s, pack)); return }
    // Bonds whose story gate opened since land now (CY13).
    if (settleBonds(save, pack) !== save) { void updateSave((s) => settleBonds(s, pack)); return }
    // A new game names the captain before anything plays (TC55).
    if (!save.captain.named) return
    if (!resumedThisLoad) {
      resumedThisLoad = true
      const first = opening(pack, save)
      if (save.mission) void navigate('/mission')
      else if (first) void navigate(`/room/bridge?node=${first}`)
    }
  }, [save, pack])

  if (!save || !pack) return <div className="flex h-full items-center justify-center bg-[#0b0d17] text-white/60">Boarding…</div>
  if (!save.captain.named) return <CaptainSetup initial={save.captain} onDone={(captain) => void updateSave((s) => ({ ...s, captain }))} />
  const debrief = save.mission ? null : debriefDue(pack, save)
  if (debrief) {
    const scene = debriefScene(debrief)
    return (
      <div data-debrief={debrief.id} className="absolute inset-0">
        <ScenePlayer key={scene.id} pack={pack} scene={scene} squad={sceneSquad(pack, save)}
          onEffect={(step) => void updateSave((s) => applyStep(s, pack, step))} onBattle={async () => {}}
          onDone={() => void updateSave((s) => markSeen(s, scene.id))} />
      </div>
    )
  }
  const card = waiting(pack, save)
  return (
    <div data-ship className="relative h-full w-full overflow-hidden bg-[#0b0d17] text-[#e8ebf5]">
      <Decks save={save} onRoom={() => {}} />
      <div className="absolute flex gap-2" style={{ top: 'calc(var(--inset-top) + 8px)', left: 'calc(var(--inset-left) + 8px)' }}>
        <button type="button" onClick={() => setMenu((m) => !m)} className="min-h-11 rounded-md bg-[#141827] px-4 font-display font-bold ring-1 ring-white/15">Menu</button>
        <button type="button" data-duties-open onClick={() => setDuties((d) => !d)} className="min-h-11 rounded-md bg-[#141827] px-4 font-display font-bold ring-1 ring-white/15">Duties</button>
        {save.inbox.length > 0 && <button type="button" data-inbox onClick={() => setInbox((v) => !v)} className="min-h-11 rounded-md bg-[#ff3dc8] px-3 font-display font-bold text-[#0b0d17]">✉ {save.inbox.length}</button>}
        <span className="flex min-h-11 items-center px-2 text-[13px] text-white/60">{save.captain.name} · Crew {save.crew.length} · {save.worlds.current ?? 'no world'}</span>
        <WalletChips save={save} />
      </div>
      {inbox && save.inbox.length > 0 && (
        <div data-messages className="absolute z-20 w-[min(26rem,80%)] space-y-2 rounded-xl bg-[#141827] p-3 ring-1 ring-white/15" style={{ top: 'calc(var(--inset-top) + 60px)', left: 'calc(var(--inset-left) + 8px)' }}>
          <div className="text-[12px] uppercase tracking-widest text-white/50">Messages after the battle</div>
          {save.inbox.map((o) => (
            <div key={o} data-message={o} className="flex items-center gap-2 rounded-md bg-white/5 p-2 text-[13px]">
              <div className="min-w-0 flex-1"><b>{outfitName(pack, o)}</b><div className="text-white/80">{fillCaptain(messageFor(o, save.watch), save.captain)}</div></div>
              <button type="button" data-reply={o} onClick={() => void updateSave((s) => replyTo(s, pack, o))} className="min-h-11 shrink-0 rounded-md bg-[#2ee6ff] px-3 font-bold text-[#0b0d17]">Reply</button>
            </div>
          ))}
        </div>
      )}
      {card && (
        <Link to={card.to} data-continue className="absolute min-h-11 rounded-lg bg-[#2ee6ff] px-4 py-2 font-display font-bold text-[#0b0d17]" style={{ top: 'calc(var(--inset-top) + 8px)', right: 'calc(var(--inset-right) + 8px)' }}>
          {card.text}
        </Link>
      )}
      <LogCard save={save} nameOf={(o) => outfitName(pack, o)} />
      {save.log?.read !== false && <EventCard save={save} pack={pack} crew={crew} nameOf={(o) => outfitName(pack, o)} />}
      {duties && <Suspense fallback={null}><DutiesPanel save={save} crew={crew} onClose={() => setDuties(false)} /></Suspense>}
      {menu && (
        <div className="absolute flex flex-col gap-2 rounded-xl bg-[#141827] p-3 ring-1 ring-white/15" style={{ top: 'calc(var(--inset-top) + 60px)', left: 'calc(var(--inset-left) + 8px)' }}>
          {[['Account', '/account'], ['Sandbox', '/sandbox'], ['Board bench', '/board'], ['Story test', '/story']].map(([label, to]) => (
            <Link key={to} to={to!} className="flex min-h-11 items-center rounded-md bg-white/5 px-3 font-semibold">{label}</Link>
          ))}
        </div>
      )}
    </div>
  )
}
