// The Quarters deck (CY11, CY14, TC42, TC60): a door for each Uma aboard (her face, her bond rank, her cabin's Comfort, a
// badge when her bond scene waits or she's asked for something), who rests next mission, and a door that opens her cabin.
import { comfortOf, STRAIN_REST } from '@cyber/domain'
import { AlbumArtProvider, FaceTile } from '@luismlorenzana/uma-kit/album'
import { useMemo, useState } from 'react'
import { applyBondEffect, bondFileOf, bondSceneDone, readyBondScene } from '../bonds/bonds'
import { Cabin, Lights } from '../cabins/Cabin'
import { tastesFor, visitsLeftNow } from '../cabins/cabins'
import { sceneSquad } from '../mission/director'
import { updateSave, useGame } from '../save/game'
import { useStory } from '../ship/useStory'
import { ScenePlayer } from '../story/ScenePlayer'
import { albumArt } from './art'
import { useCrew } from './useCrew'

export function Quarters() {
  const { crew } = useCrew()
  const pack = useStory()
  const save = useGame((g) => g.save)
  const [open, setOpen] = useState<number | null>(null)
  const [playing, setPlaying] = useState<{ outfit: number; rank: number } | null>(null)
  const nameOf = useMemo(() => (id: string) => crew.find((c) => String(c.outfit) === id)?.name ?? `Uma ${id}`, [crew])
  const art = useMemo(() => albumArt(nameOf), [nameOf])
  if (crew.length === 0) return <div className="flex h-full items-center justify-center p-10 text-center text-white/60">No one is aboard yet: the crew comes aboard through the story.</div>
  const scene = playing && pack ? bondFileOf(pack, playing.outfit)?.scenes.find((sc) => sc.rank === playing.rank) : undefined
  if (playing && pack && save && scene) {
    const outfit = playing.outfit
    return (
      <div className="absolute inset-0 z-30">
        <ScenePlayer key={`bond-${outfit}-${scene.rank}`} pack={pack} scene={{ id: `bond-${outfit}-${scene.rank}`, place: scene.place, steps: scene.steps }} squad={sceneSquad(pack, save)}
          onEffect={() => {}} onBattle={async () => {}} onBond={(e) => void updateSave((s) => applyBondEffect(s, pack, outfit, e))}
          onDone={() => { void updateSave((s) => bondSceneDone(s, outfit, scene.rank)); setPlaying(null) }} />
      </div>
    )
  }
  const pad = { padding: 'calc(var(--inset-top) + 64px) calc(var(--inset-right) + 14px) calc(var(--inset-bottom) + 14px) calc(var(--inset-left) + 14px)' }
  const cabin = open !== null && save ? crew.find((c) => c.outfit === open) : undefined
  if (cabin && save) return <div className="h-full" style={pad}><Cabin view={cabin} save={save} pack={pack} onBack={() => setOpen(null)} onBondScene={(rank) => setPlaying({ outfit: cabin.outfit, rank })} /></div>
  const resting = crew.filter((c) => c.resting)
  return (
    <div className="h-full overflow-y-auto" style={pad}>
      <div className="mb-2 flex items-baseline gap-3">
        <h2 className="font-display text-[20px] font-bold">The Quarters deck</h2>
        {save && <span className="text-[13px] text-white/60">Visits this watch: {visitsLeftNow(save)} left · a door opens her cabin</span>}
      </div>
      <AlbumArtProvider art={art}>
        <div data-roster className="grid grid-cols-5 gap-2">
          {crew.map((c) => {
            const comfort = comfortOf(c.member.cabin, tastesFor(pack, c))
            const bondReady = readyBondScene(pack, c.member) !== null
            return (
              <button key={c.outfit} type="button" data-member={c.outfit} data-door={c.outfit} onClick={() => setOpen(c.outfit)}
                className="flex flex-col items-center gap-1 rounded-xl bg-gradient-to-b from-[#1c2140] to-[#11152b] p-2 text-center ring-1 ring-white/10 hover:ring-[#2ee6ff]/50">
                <FaceTile outfitId={String(c.outfit)} size={64} label={c.name} locked={c.resting}
                  badges={{
                    topRight: bondReady ? <span data-bond-ready className="rounded bg-[#ff3dc8] px-1 text-[10px] font-bold text-[#0b0d17]">!</span>
                      : c.member.cabin.request ? <span data-asks className="rounded bg-[#2ee6ff] px-1 text-[10px] font-bold text-[#0b0d17]">?</span> : undefined,
                    bottomLeft: <span className="rounded bg-[#0b0d17]/80 px-1 text-[10px] font-bold text-[#ffb84d]">♦{c.member.bond.rank}</span>,
                    bottomRight: c.member.strain ? <span className="rounded bg-[#0b0d17]/80 px-1 text-[10px] font-bold text-[#ffb84d]">{c.member.strain}</span> : undefined,
                  }} />
                <span className="w-full truncate text-[12px] font-semibold">{c.name}</span>
                <Lights lights={comfort.lights} points={comfort.points} />
              </button>
            )
          })}
        </div>
      </AlbumArtProvider>
      <div data-resting className="mt-3 rounded-lg bg-[#141827] p-3 text-[13px] ring-1 ring-white/10">
        <div className="mb-1 font-display font-bold">Resting next mission</div>
        {resting.length ? resting.map((c) => <div key={c.outfit}>{c.name} (Strain {STRAIN_REST})</div>) : <div className="text-white/60">No one: every Uma is under Strain {STRAIN_REST}.</div>}
        <div className="mt-2 text-white/50">{crew.map((c) => `${c.name} ${c.member.strain}`).join(' · ')}</div>
      </div>
    </div>
  )
}
