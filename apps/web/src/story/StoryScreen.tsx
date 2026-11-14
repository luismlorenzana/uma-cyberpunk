// The story's test route at /story (CY9): plays the loaded story's first chapter, scene by scene and then its debrief, so
// the player can be checked before the ship exists (CY10 replaces it with the real flow). Each scene's changes go to the
// synced save's story state, and a scene seen is marked, so progress survives a reload and a sync.
import { fillFile, gainLead, seeScene, setAnomaly, setFlag, type EffectStep, type Step, type StoryPack } from '@cyber/domain'
import { TurnedStage } from '@luismlorenzana/uma-stage'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { updateStory, useGame } from '../save/game'
import { story, type LoadedStory } from './load'
import { nameOf } from './runner'
import { ScenePlayer } from './ScenePlayer'

export default function StoryScreen() {
  return <TurnedStage>{() => <Story />}</TurnedStage>
}

/** A story step's change to the save: flags, Leads, Files, Anomalies. Crew steps (join, aboard) are CY10's. */
export function applyEffect(step: EffectStep): void {
  void updateStory((s) => step.kind === 'flag' ? setFlag(s, step.flag, step.set) : step.kind === 'lead' ? gainLead(s, step.lead)
    : step.kind === 'file' ? fillFile(s, step.file, step.line) : step.kind === 'anomaly' ? setAnomaly(s, step.anomaly, step.open) : s)
}

function Story() {
  const navigate = useNavigate()
  const seenList = useGame((g) => g.save?.story.seen)
  const seen = seenList ?? []
  const [loaded, setLoaded] = useState<LoadedStory | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState<number | null>(null)
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => { story().then(setLoaded, (e: unknown) => setError(e instanceof Error ? e.message : String(e))) }, [])
  if (error) return <div className="p-6 text-[#ff3d6e]">{error}</div>
  if (!loaded) return <div className="p-6 text-white/60">Loading the story…</div>
  const pack: StoryPack = loaded.pack
  const chapter = Object.values(pack.chapters).sort((a, b) => a.id.localeCompare(b.id))[0]
  if (!chapter) return <div className="p-6 text-white/60">No chapter yet.</div>
  const scenes = [...chapter.scenes, { id: `${chapter.id}-debrief`, place: 'aboard', steps: chapter.debrief.steps }]
  const squad = pack.casting.crewOrder
  if (index !== null && scenes[index]) {
    const scene = scenes[index]!
    return (
      <ScenePlayer key={scene.id} pack={pack} scene={scene} squad={squad}
        onEffect={(step) => { applyEffect(step); if (step.kind === 'join' || step.kind === 'aboard') setNote(`${nameOf(pack, step.outfit)} ${step.kind === 'join' ? 'joins the crew' : 'comes aboard'}`) }}
        onBattle={async () => {}}
        onDone={() => { void updateStory((s) => seeScene(s, scene.id)); setIndex(index + 1 < scenes.length ? index + 1 : null) }} />
    )
  }
  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#0b0d17] p-4 text-[#e8ebf5]" style={{ paddingTop: 'calc(var(--inset-top) + 12px)', paddingLeft: 'calc(var(--inset-left) + 12px)' }}>
      <div className="mx-auto max-w-lg space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-bold">Story ({loaded.source === 'stand-in' ? 'the stand-in' : 'the pack'})</h1>
          <button type="button" onClick={() => void navigate('/')} className="min-h-11 rounded-md bg-white/10 px-4 font-bold">Home</button>
        </div>
        <div className="text-white/60">Chapter {chapter.number} of {nameOf(pack, chapter.leads[0]!)} on {chapter.world} · danger {chapter.danger}</div>
        {note && <div className="text-[#7ef0b0]">{note}</div>}
        {scenes.map((s, i) => (
          <button key={s.id} type="button" onClick={() => setIndex(i)} className="flex min-h-12 w-full items-center justify-between rounded-lg bg-[#141827] px-3 text-left">
            <span>{s.id} <span className="text-white/50">· {s.place}</span></span>
            <span className="text-[12px] text-white/50">{seen.includes(s.id) ? 'Seen' : ''}</span>
          </button>
        ))}
        <button type="button" onClick={() => setIndex(0)} className="min-h-12 w-full rounded-lg bg-[#2ee6ff] font-display font-bold text-[#0b0d17]">Play from the start</button>
      </div>
    </div>
  )
}
