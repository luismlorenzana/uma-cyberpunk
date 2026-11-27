import { battleTitle } from './player-labels'
import { wardrobeSceneArt, walkSteps, type EffectStep } from '@cyber/domain'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ScenePlayer, type SceneDecision, type ScenePresentation } from '../story/ScenePlayer'
import type { BondEffect } from '../story/runner'
import { campaignImage, type LoadedCampaign } from './load'
import { loadScenePortraits } from './portraits'
const viewport = 'absolute inset-0 overflow-y-auto bg-[#0b0d17] px-4 py-3 text-[#e8ebf5]'
const insets = { margin: 'var(--inset-top) var(--inset-right) var(--inset-bottom) var(--inset-left)' }

export function CampaignScene({ loaded, sceneId, finish, fail, battle, captainDate, decision, onExit, placeLabel, exitLabel, squad = [] }: {
  loaded: LoadedCampaign; sceneId: string; finish: (effects: readonly EffectStep[], bondEffects: readonly BondEffect[]) => void; fail: (message: string) => void
  captainDate?: boolean
  decision?: SceneDecision
  onExit?: () => void
  exitLabel?: string
  squad?: readonly number[]
  placeLabel?: string
  battle?: (id: string, effects: readonly EffectStep[]) => Promise<void>
}) {
  const scene = loaded.book.scenes.get(sceneId)!
  const art = useMemo(() => wardrobeSceneArt(loaded.book, sceneId), [loaded, sceneId])
  const [presentation, setPresentation] = useState<ScenePresentation | null>(null)
  const steps = useRef<EffectStep[]>([])
  const bonds = useRef<BondEffect[]>([])
  const leaving = useRef(false)

  useEffect(() => {
    let live = true
    const urls: string[] = []
    const pendingImages = new Map<string, Promise<string>>()
    const read = (id: string) => {
      const pending = pendingImages.get(id)
      if (pending) return pending
      const image = campaignImage(loaded.assets.get(id)!).then((url) => {
        if (live) urls.push(url)
        else URL.revokeObjectURL(url)
        return url
      })
      pendingImages.set(id, image)
      return image
    }
    const illustrated = new Set([...walkSteps(scene.steps, '')].flatMap(({ step }) =>
      step.kind === 'illustration' && step.asset ? [step.asset] : []))
    const sceneSteps = new Map([...walkSteps(scene.steps, 'steps')].map(row => [row.path, row.step]))
    void Promise.all([
      art?.backdrop ? read(art.backdrop) : undefined,
      loadScenePortraits(art?.portraits ?? [], loaded.book.portraitFaces ?? [], read, (speaker, asset) => {
        const native = loaded.book.wardrobe?.crops.find(row => row.dialogue.asset === asset)?.base
        const member = loaded.book.wardrobe?.members.find(row => row.speaker === speaker)
        const look = member && Object.values(member.looks).find(row => row.portrait === asset)
        const previous = loaded.book.art.find(row => row.scene === sceneId)?.portraits.find(row => row.speaker === speaker && row.emote === undefined)?.asset
        return [...new Set([look?.dialogue, look?.asset, native, previous].filter((id): id is string => !!id && id !== asset))]
      }),
      Promise.all([...illustrated].map(async (id) => [id, await read(id)] as const)),
      art?.composition ? Promise.all(art.composition.layers.map(async (layer) => {
        try { return { ...layer, url: await read(layer.asset) } } catch { return null }
      })) : undefined,
      art?.backdropCues ? Promise.all(art.backdropCues.map(async cue => {
        const step = sceneSteps.get(cue.at)!
        if (cue.asset === null) return { step }
        try { return { step, timing: cue.timing, url: await read(cue.asset), location: cue.location, portraits: cue.portraits } } catch { return { step } }
      })) : undefined,
    ]).then(([backdrop, portraits, illustrations, layers, backdropCues]) => {
      if (live) setPresentation({ ...(backdrop ? { backdrop } : {}), portraits, illustrations: Object.fromEntries(illustrations),
        ...(backdropCues ? { backdropCues } : {}),
        ...(art?.composition && layers ? { composition: { ...art.composition, layers: layers.filter((layer) => layer !== null) } } : {}) })
    }, (err: unknown) => { if (live) { console.warn('Campaign scene artwork:', err); fail('Could not open this scene. Try again.') } })
    return () => { live = false; urls.forEach((url) => URL.revokeObjectURL(url)) }
  }, [loaded, art, scene])

  if (!presentation) return <div className={viewport} style={insets} role="status">Loading the scene…</div>
  return <ScenePlayer pack={loaded.book.story} scene={scene} squad={squad} presentation={{ ...presentation, location: placeLabel }}
    battleTitle={id => battleTitle(loaded.book, id)} decision={decision} onExit={onExit} exitLabel={exitLabel}
    pathFooter={captainDate ? 'Either choice keeps the campaign open.' : undefined}
    onEffect={(step) => { steps.current.push(step) }}
    onBond={(effect) => { bonds.current.push(effect) }}
    onBattle={async (id) => {
      if (leaving.current) return
      leaving.current = true
      if (battle) await battle(id, steps.current)
      else fail('This scene cannot start the operation.')
    }}
    onDone={() => {
      if (leaving.current) return
      leaving.current = true
      finish(steps.current, bonds.current)
    }} />
}
