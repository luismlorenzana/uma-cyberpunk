import {
  finishCampaignNightScene, seeScene, startCampaignNight, walkSteps, type CampaignNight, type CampaignQuest, type EffectStep, type Save,
} from '@cyber/domain'
import { ContentError } from '@luismlorenzana/uma-kit/content'
import { TurnedStage } from '@luismlorenzana/uma-stage'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { CAMPAIGN_ENTRY } from '../app/campaign'
import { Account } from '../home/Account'
import { applyStep } from '../mission/director'
import { updateSave, useGame } from '../save/game'
import { ScenePlayer, type ScenePresentation } from '../story/ScenePlayer'
import { nameOf } from '../story/runner'
import { campaignImage, loadCampaign, type LoadedCampaign } from './load'

const button = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-white/10 px-4 text-sm font-semibold text-white'
const viewport = 'absolute inset-0 overflow-y-auto bg-[#0b0d17] px-4 py-3 text-[#e8ebf5]'
const insets = { margin: 'var(--inset-top) var(--inset-right) var(--inset-bottom) var(--inset-left)' }

export default function CampaignScreen() {
  return <TurnedStage>{() => <Campaign />}</TurnedStage>
}

export function CampaignAccount() {
  return <TurnedStage>{() => <div className={viewport} style={insets}>
    <Link className={button} to={CAMPAIGN_ENTRY}>Campaign</Link>
    <Account />
  </div>}</TurnedStage>
}

function Campaign() {
  const save = useGame((g) => g.save)
  const [loaded, setLoaded] = useState<LoadedCampaign | null>(null)
  const [active, setActive] = useState<CampaignQuest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(true)
  const [check, setCheck] = useState(0)
  const [eveningOpen, setEveningOpen] = useState(false)
  useEffect(() => {
    let live = true
    setPending(true)
    setError(null)
    loadCampaign().then((value) => { if (live) setLoaded(value) }, (err: unknown) => {
      if (live) setError(err instanceof ContentError && err.status === 404 ? 'Campaign release unavailable.'
        : err instanceof Error ? err.message : String(err))
    }).finally(() => { if (live) setPending(false) })
    return () => { live = false }
  }, [check])
  const reduceEffects = (s: Save, effects: readonly EffectStep[]): Save =>
    loaded ? effects.reduce((state, step) => applyStep(state, loaded.book.story, step), s) : s
  if (loaded && active) return <CampaignScene key={active.scene} loaded={loaded} sceneId={active.scene}
    finish={(effects) => void updateSave((s) => {
      if (s.story.seen.includes(active.scene)) return s
      const next = reduceEffects(s, effects)
      return { ...next, story: seeScene(next.story, active.scene) }
    }).then(() => setActive(null))}
    fail={(message) => { setError(message); setActive(null) }} />

  const day = save?.campaignDay
  const night = day?.pending
  if (loaded && day && night && !error && loaded.book.scenes.has(night.scene)) {
    return <CampaignScene key={`${day.day}:${night.kind}:${night.scene}`} loaded={loaded} sceneId={night.scene}
      fail={setError}
      finish={(effects) => void updateSave((s) => {
        const campaignDay = finishCampaignNightScene(s.campaignDay, day.day, night)
        return campaignDay === s.campaignDay ? s : { ...reduceEffects(s, effects), campaignDay }
      })} />
  }

  const complete = new Set(loaded?.book.quests.filter((q) => save?.story.seen.includes(q.scene)).map((q) => q.id))
  const available = loaded?.book.quests.filter((q) => !complete.has(q.id) && (q.after === undefined || complete.has(q.after))) ?? []
  const evening = loaded?.book.evening
  const canRest = !!(day && !night && evening && complete.has(evening.after))
  const visitOptions = canRest ? evening?.visits.filter((v) => save?.crew.some((crew) => crew.outfit === v.companion)) ?? [] : []
  function chooseEvening(visit: Extract<CampaignNight, { kind: 'visit' }> | null) {
    setEveningOpen(false)
    void updateSave((s) => {
      if (!canRest || s.campaignDay.day !== day?.day || (visit && !s.crew.some((crew) => crew.outfit === visit.companion))) return s
      const campaignDay = startCampaignNight(s.campaignDay, visit)
      return campaignDay === s.campaignDay ? s : { ...s, campaignDay }
    })
  }
  return (
    <main className={viewport} style={insets} data-campaign>
      <div className="mx-auto max-w-xl space-y-3">
        <nav className="flex flex-wrap gap-2">
          <a href="/" className={button}>Original campaign</a>
          <Link to="/campaign/account" className={button}>Account</Link>
        </nav>
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-xl font-bold">Campaign preview</h1>
          <button type="button" className={button} disabled={pending} onClick={() => setCheck((n) => n + 1)}>Check release</button>
        </div>
        {loaded && <p className="text-sm text-white/65" data-campaign-release>{loaded.release.release}{loaded.book.draft ? ' · Draft' : ''}</p>}
        {day && <p className="text-sm text-white/65">Day {day.day}</p>}
        {pending && <p role="status">Checking the release…</p>}
        {error && <p role="alert" className="break-words text-[#ffa7b7]">{error}</p>}
        {night && !pending && !error && <p role="alert" className="text-[#ffa7b7]">This release is missing the saved scene.</p>}
        {save && !night && available.map((quest) => <button key={quest.id} type="button" onClick={() => setActive(quest)}
          className="block min-h-11 w-full rounded-lg bg-[#2ee6ff] px-4 text-left font-bold text-[#0b0d17]">{quest.title}</button>)}
        {canRest && !eveningOpen && <button type="button" className={button} onClick={() => setEveningOpen(true)}>End day</button>}
        {canRest && eveningOpen && loaded && <section aria-label="Evening" className="flex flex-wrap gap-2">
          {visitOptions.map((visit) => <button key={visit.companion} type="button" className={button}
            onClick={() => chooseEvening({ kind: 'visit', ...visit })}>Visit {nameOf(loaded.book.story, visit.companion)}</button>)}
          <button type="button" className={button} onClick={() => chooseEvening(null)}>My quarters</button>
          <button type="button" className={button} onClick={() => setEveningOpen(false)}>Back</button>
        </section>}
        {loaded && !pending && !night && !canRest && available.length === 0 && <p className="text-white/65">You’re caught up.</p>}
      </div>
    </main>
  )
}

function CampaignScene({ loaded, sceneId, finish, fail }: {
  loaded: LoadedCampaign; sceneId: string; finish: (effects: readonly EffectStep[]) => void; fail: (message: string) => void
}) {
  const scene = loaded.book.scenes.get(sceneId)!
  const art = loaded.book.art.find((entry) => entry.scene === sceneId)
  const [presentation, setPresentation] = useState<ScenePresentation | null>(null)
  const steps = useRef<EffectStep[]>([])
  const leaving = useRef(false)

  useEffect(() => {
    let live = true
    const urls: string[] = []
    const read = async (id: string) => {
      const url = await campaignImage(loaded.assets.get(id)!)
      if (live) urls.push(url)
      else URL.revokeObjectURL(url)
      return url
    }
    const illustrated = new Set([...walkSteps(scene.steps, '')].flatMap(({ step }) =>
      step.kind === 'illustration' && step.asset ? [step.asset] : []))
    void Promise.all([
      art?.backdrop ? read(art.backdrop) : undefined,
      Promise.all(art?.portraits.map(async ({ speaker, asset, emote }) => ({ speaker, url: await read(asset), ...(emote === undefined ? {} : { emote }) })) ?? []),
      Promise.all([...illustrated].map(async (id) => [id, await read(id)] as const)),
    ]).then(([backdrop, portraits, illustrations]) => {
      if (live) setPresentation({ ...(backdrop ? { backdrop } : {}), portraits, illustrations: Object.fromEntries(illustrations) })
    }, (err: unknown) => { if (live) fail(err instanceof Error ? err.message : String(err)) })
    return () => { live = false; urls.forEach((url) => URL.revokeObjectURL(url)) }
  }, [loaded, art, scene])

  if (!presentation) return <div className={viewport} style={insets} role="status">Loading the scene…</div>
  return <ScenePlayer pack={loaded.book.story} scene={scene} squad={[]} presentation={presentation}
    onEffect={(step) => { steps.current.push(step) }}
    onBattle={async () => { leaving.current = true; fail('This mission is unavailable in this preview.') }}
    onDone={() => {
      if (leaving.current) return
      leaving.current = true
      finish(steps.current)
    }} />
}
