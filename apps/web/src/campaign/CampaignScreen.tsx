import {
  campaignHomeSupport, finaleAllies, finishCampaignNightScene, homeOutcome, pairProgress, pairVisit, seeScene,
  startCampaignNight, startSupply, walkSteps,
  type CampaignDay, type CampaignQuest, type CampaignVisit, type EffectStep, type Save,
} from '@cyber/domain'
import { ContentError } from '@luismlorenzana/uma-kit/content'
import { TurnedStage, type StageLayout } from '@luismlorenzana/uma-stage'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { CAMPAIGN_ENTRY } from '../app/campaign'
import { Account } from '../home/Account'
import { applyStep, setSquad, startMission } from '../mission/director'
import { updateSave, useGame } from '../save/game'
import { ScenePlayer, type ScenePresentation } from '../story/ScenePlayer'
import { nameOf, type BondEffect } from '../story/runner'
import { campaignImage, loadCampaign, type LoadedCampaign } from './load'
import { closePairScene, nextHomeScene, openPairScene, pairAvailable, pairSceneReady, recordPairScene } from './pair'
import { PairPanel } from './PairPanel'
import { HomePanel } from './HomePanel'
import { FinalePanel } from './FinalePanel'
import { questAvailable, questComplete } from './quests'
import { SupplyPanel } from './SupplyPanel'
import { settleCampaignDay } from './watch'
import { creditCampaignDates, dateAvailable, dateProgress, dateScene, recordDateScene } from './dates'
import { DatePanel } from './DatePanel'

const button = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-white/10 px-4 text-sm font-semibold text-white'
const viewport = 'absolute inset-0 overflow-y-auto bg-[#0b0d17] px-4 py-3 text-[#e8ebf5]'
const insets = { margin: 'var(--inset-top) var(--inset-right) var(--inset-bottom) var(--inset-left)' }
const GroundScreen = lazy(() => import('./GroundScreen'))
const ShipCommandScreen = lazy(() => import('./ShipCommandScreen'))
const WorkshopPanel = lazy(() => import('./WorkshopPanel'))

export default function CampaignScreen() {
  return <TurnedStage>{(layout) => <Campaign layout={layout} />}</TurnedStage>
}

export function CampaignAccount() {
  return <TurnedStage>{() => <div className={viewport} style={insets}>
    <Link className={button} to={CAMPAIGN_ENTRY}>Campaign</Link>
    <Account />
  </div>}</TurnedStage>
}

function Campaign({ layout }: { layout: StageLayout }) {
  const save = useGame((g) => g.save)
  const [loaded, setLoaded] = useState<LoadedCampaign | null>(null)
  const [active, setActive] = useState<CampaignQuest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(true)
  const [check, setCheck] = useState(0)
  const [eveningOpen, setEveningOpen] = useState(false)
  const [groundPaused, setGroundPaused] = useState(false)
  const [savingScene, setSavingScene] = useState(false)
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
  useEffect(() => {
    if (loaded && save) void updateSave((current) => creditCampaignDates(current, loaded.book))
  }, [loaded, save])
  function commitScene(change: (save: Save) => Save) {
    setSavingScene(true)
    void updateSave(change).finally(() => setSavingScene(false))
  }
  if (savingScene) return <div className={viewport} style={insets} role="status">Saving…</div>
  const reduceEffects = (s: Save, effects: readonly EffectStep[]): Save =>
    loaded ? effects.reduce((state, step) => applyStep(state, loaded.book.story, step), s) : s
  const day = save?.campaignDay
  const night = day?.pending
  const pendingPair = save?.pairScene
  const complete = new Set(save ? loaded?.book.quests.filter((q) => questComplete(save, q)).map((q) => q.id) : [])
  const network = loaded?.book.supply
  const supply = network && complete.has(network.after) ? save?.campaignSupply ?? startSupply(network) : undefined
  const port = supply && network?.ports.find((p) => p.id === supply.port)
  const pairs = loaded && save ? loaded.book.pairs.filter((pair) => pairAvailable(save, loaded.book, pair)) : []
  const dates = loaded && save ? (loaded.book.dates ?? []).filter((date) => dateAvailable(save, loaded.book, date)) : []
  const support = save ? campaignHomeSupport(pairs, save.story) : null
  const missionState = save?.mission
  const missionChapter = missionState && loaded?.book.story.chapters[missionState.chapter]
  const mission = missionChapter && missionChapter.missions.find((m) => m.id === missionState?.id)
  const training = mission?.scenario === 'training'
  const command = mission && loaded?.book.commands.get(mission.id)
  const ground = mission && loaded?.book.ground.get(mission.id)
  const trainee = missionState?.squad[0] ?? missionChapter?.leads[0]
  if (loaded && save && mission && (training || ground) && trainee !== undefined && !support?.ashore.has(trainee) && !groundPaused) {
    return <Suspense fallback={<div className={viewport} style={insets} role="status">Loading mission…</div>}>
      <GroundScreen key={mission.id} save={save} mission={mission} layout={layout} trainee={trainee} label={nameOf(loaded.book.story, trainee)}
        ground={ground || undefined} pack={loaded.book.story} bossArt={ground && ground.boss ? loaded.assets.get(ground.boss.portrait) : undefined}
        acceptsFitted={loaded.book.workshop?.missions.includes(mission.id)}
        close={() => setGroundPaused(true)} />
    </Suspense>
  }
  if (loaded && save && mission && command && supply && support) {
    const quest = loaded.book.quests.find((quest) => quest.encounter === mission.id)
    const art = loaded.book.art.find((entry) => entry.scene === quest?.scene)
    const home = pairs.find(({ home }) => home?.defense === quest?.id)?.home
    const homeDefense = home && port ? { name: port.name, relay: homeOutcome(home, save.story) === 'resettle' ? home.support.relay : 0 } : undefined
    const operation = loaded.book.finale
    const finale = operation && operation.approach === quest?.id
      ? { allies: finaleAllies(loaded.book, save.story), preparation: operation.preparation } : undefined
    const emitterRoute = command.assault && [...loaded.book.ground.values()]
      .find(({ alternate }) => alternate?.flag === command.assault?.disabledFlag)?.alternate?.label
    return <Suspense fallback={<div className={viewport} style={insets} role="status">Opening the bridge…</div>}>
      <ShipCommandScreen save={save} mission={mission} encounter={command} supply={supply} backdrop={art?.backdrop ? loaded.assets.get(art.backdrop) : undefined}
        ashore={support.ashore} homeDefense={homeDefense} finale={finale} emitterRoute={emitterRoute}
        names={new Map(save.crew.filter(({ outfit }) => !support.ashore.has(outfit)).map(({ outfit }) => [outfit, nameOf(loaded.book.story, outfit)]))} />
    </Suspense>
  }
  if (loaded && active) return <CampaignScene key={active.scene} loaded={loaded} sceneId={active.scene}
    battle={async (id, effects) => {
      const chapter = Object.values(loaded.book.story.chapters).find((c) => c.scenes.some((scene) => scene.id === active.scene))
      const mission = chapter?.missions.find((m) => m.id === active.encounter && m.id === id)
      const training = mission?.scenario === 'training' && chapter && (mission.fixedSquad ?? chapter.leads).length === 1
      if (!chapter || !mission || (!training && !loaded.book.commands.has(id) && !loaded.book.ground.has(id))) {
        setError('This release is missing the encounter.')
      } else {
        await updateSave((s) => {
          if (s.mission || s.pairScene || s.campaignDay.pending || (active.port && active.port !== (s.campaignSupply?.port ?? supply?.port))) return s
          if (!questAvailable(s, loaded.book, active, s.campaignSupply?.port ?? supply?.port)) return s
          const next = reduceEffects(s, effects)
          const started = startMission({ ...next, story: seeScene(next.story, active.scene) }, chapter, mission)
          const { ashore } = campaignHomeSupport(loaded.book.pairs, s.story)
          const squad = started.mission!.squad.filter((outfit) => !ashore.has(outfit))
          return !squad.length && !loaded.book.commands.has(id) ? s : setSquad(started, squad)
        })
        setGroundPaused(false)
      }
      setActive(null)
    }}
    finish={(effects) => void updateSave((s) => {
      if (!questAvailable(s, loaded.book, active, s.campaignSupply?.port ?? supply?.port)) return s
      const next = reduceEffects(s, effects)
      return { ...next, story: seeScene(next.story, active.scene) }
    }).then(() => setActive(null))}
    fail={(message) => { setError(message); setActive(null) }} />

  const pairScene = pendingPair && pairs.find((pair) => pair.id === pendingPair.pair)
  if (loaded && save && pendingPair && pairScene && !error && loaded.book.scenes.has(pendingPair.scene)
    && pairSceneReady(save, loaded.book, pairScene, pendingPair.scene)) {
    return <CampaignScene key={pendingPair.scene} loaded={loaded} sceneId={pendingPair.scene} fail={setError}
      finish={(effects) => commitScene((s) => closePairScene(s, loaded.book, pairScene, pendingPair.scene, effects))} />
  }

  function settleDay(s: Save, campaignDay: CampaignDay): Save {
    return supply && loaded ? settleCampaignDay(s, campaignDay, loaded.book) : { ...s, campaignDay }
  }
  const nightPair = night && 'pair' in night ? pairs.find((pair) => pair.id === night.pair) : undefined
  const nightDate = night && 'companion' in night
    ? loaded?.book.dates?.find((date) => date.companion === night.companion && dateScene(date, night.scene)) : undefined
  if (loaded && day && night && !error && loaded.book.scenes.has(night.scene) && (!('pair' in night) || nightPair)) {
    return <CampaignScene key={`${day.day}:${night.kind}:${night.scene}`} loaded={loaded} sceneId={night.scene}
      fail={setError} captainDate={!!nightDate}
      finish={(effects, bondEffects) => (nightPair || nightDate ? commitScene : updateSave)((s) => {
        const campaignDay = finishCampaignNightScene(s.campaignDay, day.day, night)
        if (campaignDay === s.campaignDay) return s
        const next = nightPair ? recordPairScene(s, loaded.book, nightPair, night.scene, effects)
          : nightDate ? recordDateScene(s, loaded.book, nightDate, night.scene, effects, bondEffects) : reduceEffects(s, effects)
        return settleDay(next, campaignDay)
      })} />
  }
  if (loaded && save && port && !night && !pendingPair && !missionState && !error && !save.story.seen.includes(port.scene)) {
    return <CampaignScene key={port.scene} loaded={loaded} sceneId={port.scene} fail={setError}
      finish={(effects) => void updateSave((s) => {
        if (s.story.seen.includes(port.scene)) return s
        const next = reduceEffects(s, effects)
        return { ...next, story: seeScene(next.story, port.scene) }
      })} />
  }

  const available = loaded && save ? loaded.book.quests.filter((q) => questAvailable(save, loaded.book, q, supply?.port)) : []
  const evening = loaded?.book.evening
  const canRest = !!(day && !night && !pendingPair && !missionState && evening && complete.has(evening.after))
  const supplyPanel = loaded && save && supply && network && port && support && !night && !pendingPair && !missionState && !eveningOpen
    ? <SupplyPanel save={save} network={network} supply={supply} port={port} worlds={loaded.book.story.worlds} upkeep={support.provisions} /> : null
  const basePanels = loaded && save && port && !night && !pendingPair && !missionState && !eveningOpen ? pairs.flatMap((pair) => {
    const home = pair.home
    if (!home || home.port !== port.id || !complete.has(home.base)) return []
    return [<HomePanel key={pair.id} pair={pair} home={home} name={port.name} story={save.story} pack={loaded.book.story}
      next={nextHomeScene(save, loaded.book, pair)} defended={complete.has(home.defense)}
      open={(scene) => commitScene((s) => openPairScene(s, loaded.book, pair, scene))} />]
  }) : []
  const pairPanels = loaded && save && !night && !pendingPair && !missionState && !eveningOpen ? pairs.filter((pair) =>
    !pair.members.some(({ outfit }) => support?.ashore.has(outfit))).map((pair) => (
    <PairPanel key={pair.id} pair={pair} story={save.story} pack={loaded.book.story}
      open={(scene) => commitScene((s) => openPairScene(s, loaded.book, pair, scene))} />
  )) : []
  const datePanel = loaded && save && dates.length > 0 && !night && !pendingPair && !missionState && !eveningOpen
    ? <DatePanel save={save} book={loaded.book} dates={dates} /> : null
  const workshop = loaded?.book.workshop
  const workshopPanel = loaded && save && support && workshop && !night && !pendingPair && !missionState && !eveningOpen
    && workshop.port === port?.id && complete.has(workshop.after)
    ? <Suspense fallback={null}><WorkshopPanel save={save} loaded={loaded} ashore={support.ashore} /></Suspense> : null
  const side = supplyPanel || datePanel || pairPanels.length + basePanels.length > 0
  const visitOptions = canRest ? evening?.visits.filter((v) => !support?.ashore.has(v.companion) && save?.crew.some((crew) => crew.outfit === v.companion)) ?? [] : []
  const dateOptions = loaded && save && canRest ? dates.map((date) => {
    const visit = dateProgress(save, loaded.book, date).visit
    return { visit: { kind: 'visit' as const, companion: date.companion, scene: visit.scene, morning: visit.morning }, title: visit.title }
  }) : []
  const pairVisits = loaded && save && canRest ? pairs.flatMap((pair) => {
    const visit = pairVisit(pair, save.story, save.crew.flatMap(({ outfit }) => support?.ashore.has(outfit) ? [] : [outfit]))
    if (!visit) return []
    const progress = pairProgress(pair, save.story)
    const [first, second] = pair.members.map(({ outfit }) => nameOf(loaded.book.story, outfit))
    const label = !progress.released ? `Visit ${second} in the brig` : progress.residency === 'shared' ? `Visit ${first} and ${second}` : `Visit ${second}’s cabin`
    return [{ visit, label }]
  }) : []
  function chooseEvening(visit: CampaignVisit | null) {
    setEveningOpen(false)
    void (visit ? commitScene : updateSave)((s) => {
      if (!canRest || s.campaignDay.day !== day?.day || s.pairScene || s.mission) return s
      const { ashore } = campaignHomeSupport(loaded?.book.pairs ?? [], s.story)
      if (visit?.kind === 'visit' && (ashore.has(visit.companion) || !s.crew.some((crew) => crew.outfit === visit.companion))) return s
      if (visit?.kind === 'visit' && loaded) {
        const date = loaded.book.dates?.find(({ companion }) => companion === visit.companion)
        if (date) {
          if (!dateAvailable(s, loaded.book, date)) return s
          const ready = dateProgress(s, loaded.book, date).visit
          if (ready.scene !== visit.scene || ready.morning !== visit.morning) return s
        }
      }
      if (visit?.kind === 'pair-visit') {
        const pair = loaded?.book.pairs.find((pair) => pair.id === visit.pair)
        const live = pair && loaded && pairAvailable(s, loaded.book, pair)
          && pairVisit(pair, s.story, s.crew.flatMap(({ outfit }) => ashore.has(outfit) ? [] : [outfit]))
        if (!live || live.scene !== visit.scene || live.morning !== visit.morning) return s
      }
      const campaignDay = startCampaignNight(s.campaignDay, visit)
      return campaignDay === s.campaignDay ? s : settleDay(s, campaignDay)
    })
  }
  return (
    <main className={viewport} style={insets} data-campaign>
      <div className={side ? 'mx-auto grid max-w-5xl items-start gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]' : 'mx-auto max-w-xl'}>
        <div className="space-y-3">
          <nav className="flex flex-wrap gap-2">
            <a href="/" className={button}>Original campaign</a>
            <Link to="/campaign/account" className={button}>Account</Link>
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="font-display text-xl font-bold">Campaign preview</h1>
            <button type="button" className={button} disabled={pending} onClick={() => setCheck((n) => n + 1)}>Check release</button>
          </div>
          {loaded && <p className="text-sm text-white/65" data-campaign-release>{loaded.release.release}{loaded.book.draft ? ' · Draft' : ''}</p>}
          {day && <p className="text-sm text-white/65">Day {day.day}</p>}
          {pending && <p role="status">Checking the release…</p>}
          {error && <p role="alert" className="break-words text-[#ffa7b7]">{error}</p>}
          {(night || pendingPair) && !pending && !error && <p role="alert" className="text-[#ffa7b7]">This release is missing the saved scene.</p>}
          {supply && !port && <p role="alert" className="text-[#ffa7b7]">This release is missing the saved port.</p>}
          {missionState && (training || ground) && <button type="button" className={button} onClick={() => setGroundPaused(false)}>Resume {ground?.title ?? 'Training'}</button>}
          {missionState && loaded && !training && !ground && <p role="alert" className="text-[#ffa7b7]">This release is missing the saved encounter.</p>}
          {save && !night && !pendingPair && !missionState && available.map((quest) => <button key={quest.id} type="button" onClick={() => setActive(quest)}
            className="block min-h-11 w-full rounded-lg bg-[#2ee6ff] px-4 text-left font-bold text-[#0b0d17]">{quest.title}</button>)}
          {canRest && !eveningOpen && <button type="button" className={button} onClick={() => setEveningOpen(true)}>End day</button>}
          {canRest && eveningOpen && loaded && <section aria-label="Evening" className="flex flex-wrap gap-2">
            {visitOptions.map((visit) => <button key={visit.companion} type="button" className={button}
              onClick={() => chooseEvening({ kind: 'visit', ...visit })}>Visit {nameOf(loaded.book.story, visit.companion)}</button>)}
            {dateOptions.map(({ visit, title }) => <button key={visit.companion} type="button" className={button}
              onClick={() => chooseEvening(visit)}>{nameOf(loaded.book.story, visit.companion)} · {title}</button>)}
            {pairVisits.map(({ visit, label }) => <button key={visit.pair} type="button" className={button} onClick={() => chooseEvening(visit)}>{label}</button>)}
            <button type="button" className={button} onClick={() => chooseEvening(null)}>My quarters</button>
            <button type="button" className={button} onClick={() => setEveningOpen(false)}>Back</button>
          </section>}
          {loaded && !pending && !night && !pendingPair && !missionState && !canRest && !supply && available.length === 0 && <p className="text-white/65">You’re caught up.</p>}
        </div>
        {side && <div className="space-y-3">
          {loaded?.book.finale && save && supply && !night && !pendingPair && !missionState && !eveningOpen &&
            <FinalePanel book={loaded.book} story={save.story} complete={complete.has(loaded.book.finale.ending)} />}
          {datePanel}
          {workshopPanel}
          {pairPanels}
          {basePanels}
          {supplyPanel}
          {loaded && save && Object.keys(save.story.files).length > 0 && <section aria-label="Evidence" className="space-y-2 rounded-xl border border-white/15 p-3">
            <h2 className="font-display text-lg font-bold">Evidence</h2>
            {Object.entries(save.story.files).map(([id, indices]) => {
              const evidence = loaded.book.story.files[id]
              return evidence && <ul key={id} aria-label={id.replaceAll('-', ' ')} className="space-y-1 text-sm">
                {indices.map((index) => evidence.lines[index] && <li key={index}>{evidence.lines[index]!.text}</li>)}
              </ul>
            })}
          </section>}
        </div>}
      </div>
    </main>
  )
}

function CampaignScene({ loaded, sceneId, finish, fail, battle, captainDate }: {
  loaded: LoadedCampaign; sceneId: string; finish: (effects: readonly EffectStep[], bondEffects: readonly BondEffect[]) => void; fail: (message: string) => void
  captainDate?: boolean
  battle?: (id: string, effects: readonly EffectStep[]) => Promise<void>
}) {
  const scene = loaded.book.scenes.get(sceneId)!
  const art = loaded.book.art.find((entry) => entry.scene === sceneId)
  const [presentation, setPresentation] = useState<ScenePresentation | null>(null)
  const steps = useRef<EffectStep[]>([])
  const bonds = useRef<BondEffect[]>([])
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
    pathFooter={captainDate ? 'Either choice keeps the campaign open.' : undefined}
    onEffect={(step) => { steps.current.push(step) }}
    onBond={(effect) => { bonds.current.push(effect) }}
    onBattle={async (id) => {
      if (leaving.current) return
      leaving.current = true
      if (battle) await battle(id, steps.current)
      else fail('This scene can’t start an exercise.')
    }}
    onDone={() => {
      if (leaving.current) return
      leaving.current = true
      finish(steps.current, bonds.current)
    }} />
}
