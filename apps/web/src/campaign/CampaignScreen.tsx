import type { SceneDecision } from '../story/ScenePlayer'
import {
  awayMembers, campaignCaptures, campaignSpeaker, campaignSupport, campaignUpkeep, CORE_CAPTURES, crewSpeaker, developedPort, expeditionReadiness, finaleAllies, finishCampaignNightScene, fleetMobilized, homeOutcome, pairProgress, pairVisit, rehabilitationQuestIds, seeScene, SIGNAL_CAPTURES,
  sectorNightId, sectorVisit, startCampaignNight, startSupply,
  type CabinEvening, type CampaignDay, type CampaignQuest, type CampaignReleaseFile, type CampaignVisit, type EffectStep, type Save, type Speaker,
} from '@cyber/domain'
import { ContentError } from '@luismlorenzana/uma-kit/content'
import { TurnedStage, type StageLayout } from '@luismlorenzana/uma-stage'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { campaignAccount, campaignEntry, campaignIdentity } from '../app/campaign'
import { Account } from '../home/Account'
import { applyStep } from '../mission/director'
import { updateSave, useGame } from '../save/game'
import { nameOf } from '../story/runner'
import { loadCampaign, type LoadedCampaign } from './load'
import { CampaignScene } from './CampaignScene'
import { locationAvailable, locationState, managementAt } from './management'
import { availableSharedVisit, closePairScene, nextHomeScene, openPairScene, pairAvailable, pairSceneReady, postponeLockedHomeScene, recordPairScene } from './pair'
import { PairPanel } from './PairPanel'
import { HomePanel } from './HomePanel'
import { FinalePanel } from './FinalePanel'
import { finishCampaignDialogue, optionalCampaignTraining, personalMissionLead, questAvailable, questComplete, questScene } from './quests'
import { missionAshore } from './call-up'
import { RecruitmentPanel } from './RecruitmentPanel'
import { SectorPanel } from './SectorPanel'
import { ProjectsPanel } from './ProjectsPanel'
import { SupplyPanel } from './SupplyPanel'
import { settleCampaignDay } from './watch'
import { chooseDatePath, creditCampaignDates, dateAvailable, dateProgress, dateScene, recordDateScene } from './dates'
import { DatePanel } from './DatePanel'
import { expeditionForQuest, expeditionQuestBlock, expeditionWatchScene } from './expedition'
import { beginCampaignEncounter } from './sortie'
import { cabinAvailable, chooseCabinOutcome, finishCabinScene, leaveCabinEarly, startCabinEvening } from './cabins'

const button = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-white/10 px-4 text-sm font-semibold text-white'
const viewport = 'absolute inset-0 overflow-y-auto bg-[#0b0d17] px-4 py-3 text-[#e8ebf5]'
const insets = { margin: 'var(--inset-top) var(--inset-right) var(--inset-bottom) var(--inset-left)' }
const GroundScreen = lazy(() => import('./GroundScreen'))
const ShipCommandScreen = lazy(() => import('./ShipCommandScreen'))
const WorkshopPanel = lazy(() => import('./WorkshopPanel'))
const LocationScreen = lazy(() => import('./LocationScreen'))

export default function CampaignScreen() {
  return <TurnedStage>{(layout) => <Campaign layout={layout} />}</TurnedStage>
}

export function CampaignAccount() {
  return <TurnedStage>{() => <div className={viewport} style={insets}>
    <Link className={button} to={campaignEntry}>Campaign</Link>
    <Account />
  </div>}</TurnedStage>
}

function Campaign({ layout }: { layout: StageLayout }) {
  const save = useGame((g) => g.save)
  const owner = useGame((g) => g.uid)
  const [loaded, setLoaded] = useState<LoadedCampaign | null>(null)
  const [location, setLocation] = useState<string | null>(null)
  const [reportScene, setReportScene] = useState<string | null>(null)
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
    loadCampaign(undefined, owner ?? undefined, campaignIdentity).then((value) => { if (live) setLoaded(value) }, (err: unknown) => {
      if (live) setError(err instanceof ContentError && err.status === 404 ? 'Campaign release unavailable.'
        : err instanceof Error ? err.message : String(err))
    }).finally(() => { if (live) setPending(false) })
    return () => { live = false }
  }, [check, owner])
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
  const complete = new Set(save && loaded ? loaded.book.quests.filter((q) => questComplete(save, q, loaded.book)).map((q) => q.id) : [])
  const catalog = loaded?.book.fourAct
  const expeditions = catalog && [...catalog.duos.values()].map(duo => ({ duo, readiness: expeditionReadiness(catalog, duo.id, complete)! }))
  const network = loaded?.book.supply
  const supply = network && complete.has(network.after) ? save?.campaignSupply ?? startSupply(network) : undefined
  const port = supply && network?.ports.find((p) => p.id === supply.port)
  const pairs = loaded && save ? loaded.book.pairs.filter((pair) => pairAvailable(save, loaded.book, pair)) : []
  const dates = loaded && save ? (loaded.book.dates ?? []).filter((date) => dateAvailable(save, loaded.book, date)) : []
  const expedition = save?.expedition
  const support = loaded && save ? campaignSupport(loaded.book, save) : null
  const missionState = save?.mission
  const sortieAshore = loaded && save && missionState?.callUp ? missionAshore(loaded.book, save) : support?.ashore
  const missionChapter = missionState && loaded?.book.story.chapters[missionState.chapter]
  const mission = missionChapter && missionChapter.missions.find((m) => m.id === missionState?.id)
  const training = mission?.scenario === 'training'
  const trainingQuest = training ? loaded?.book.quests.find(({ encounter }) => encounter === mission.id) : undefined
  const optionalTraining = !!(trainingQuest && loaded && optionalCampaignTraining(loaded.book, trainingQuest))
  const missionQuest = mission && loaded?.book.quests.find(({ encounter }) => encounter === mission.id)
  const expeditionFight = loaded && missionQuest ? expeditionForQuest(loaded.book, missionQuest.id, save?.expedition?.duo) : undefined
  const personalLead = loaded && missionQuest ? personalMissionLead(loaded.book, missionQuest) : undefined
  const command = mission && loaded?.book.commands.get(mission.id)
  const ground = mission && loaded?.book.ground.get(mission.id)
  const trainee = personalLead ?? missionState?.squad[0] ?? missionChapter?.leads[0]
  if (loaded && save && mission && (training || ground) && trainee !== undefined && !sortieAshore?.has(trainee) && !groundPaused) {
    return <Suspense fallback={<div className={viewport} style={insets} role="status">Loading mission…</div>}>
      <GroundScreen key={mission.id} loaded={loaded} save={save} mission={mission} layout={layout} trainee={trainee} label={nameOf(loaded.book.story, trainee)}
        expedition={expeditionFight?.expedition?.route?.name} ground={ground || undefined} pack={loaded.book.story} bossArt={ground && ground.boss ? loaded.assets.get(ground.boss.portrait) : undefined}
        combatSprites={loaded.release.combatSprites}
        acceptsFitted={loaded.book.workshop?.missions.includes(mission.id)}
        ashore={sortieAshore} requiredLead={personalLead}
        editableSquad={!!ground && (!!loaded.book.sectors?.length || !!missionState?.callUp || personalLead !== undefined)}
        close={() => setGroundPaused(true)} />
    </Suspense>
  }
  if (loaded && save && mission && command && supply && support) {
    const quest = missionQuest
    const art = loaded.book.art.find((entry) => entry.scene === quest?.scene)
    const commandArt = loaded.book.commandArt?.get(command.id)
    const backdrop = commandArt?.backdrop ?? art?.backdrop
    const home = pairs.find(({ home }) => home?.defense === quest?.id)?.home
    const homeDefense = home && port ? { name: port.name, relay: homeOutcome(home, save.story) === 'resettle' ? home.support.relay : 0 } : undefined
    const operation = loaded.book.finale
    const finale = operation && operation.approach === quest?.id
      ? { allies: finaleAllies(loaded.book, save.story), preparation: operation.preparation,
        ...(operation.muster ? { contributions: fleetMobilized(loaded.book, save.story).map((sector) => `${sector.title} · ${sector.contribution}`) } : {}) } : undefined
    const emitterRoute = command.assault && [...loaded.book.ground.values()]
      .find(({ alternate }) => alternate?.flag === command.assault?.disabledFlag)?.alternate?.label
    const portraits = new Map<Speaker, CampaignReleaseFile>()
    const profiles = new Map<Speaker, CampaignReleaseFile>()
    for (const entry of loaded.book.art) for (const { speaker, asset, emote, profile } of entry.portraits) {
      if (typeof speaker !== 'number' || emote !== undefined) continue
      const image = loaded.assets.get(profile ?? asset)
      if (image) (profile ? profiles : portraits).set(speaker, image)
    }
    for (const member of save.crew) {
      if (!member.heroine) continue
      const look = loaded.book.wardrobe?.members.find(row => row.speaker === member.heroine)?.looks['combat-station']
      const image = look && loaded.assets.get(look.profile ?? look.portrait ?? look.dialogue ?? look.asset)
      if (image) profiles.set(member.heroine, image)
    }
    return <Suspense fallback={<div className={viewport} style={insets} role="status">Opening the bridge…</div>}>
      <ShipCommandScreen loaded={loaded} save={save} mission={mission} encounter={command} supply={supply}
        backdrop={backdrop ? loaded.assets.get(backdrop) : undefined}
        objectiveArt={commandArt?.objective ? loaded.assets.get(commandArt.objective) : undefined}
        objectiveLabel={commandArt?.objectiveLabel}
        ashore={sortieAshore ?? support.ashore} requiredLead={personalLead} homeDefense={homeDefense} finale={finale} emitterRoute={emitterRoute}
        qualifications={new Map(loaded.book.sectors?.map((sector) => [sector.officer, sector.qualification]))}
        portraits={new Map([...portraits, ...profiles])}
        names={new Map(save.crew.filter(({ outfit, heroine, expeditionOnly }) => !expeditionOnly && (personalLead === undefined || !heroine)
          && !sortieAshore?.has(outfit) && !awayMembers(save.operations, save.squads).includes(outfit)).map(member => [member.outfit, nameOf(loaded.book.story, crewSpeaker(member))]))} />
    </Suspense>
  }
  if (loaded && save && reportScene && loaded.book.scenes.has(reportScene)) {
    return <CampaignScene key={reportScene} loaded={loaded} sceneId={reportScene}
      squad={save.expedition?.members.flatMap(member => member.role === 'uma' ? [member.outfit] : [])}
      fail={message => { setError(message); setReportScene(null) }} onExit={() => setReportScene(null)} exitLabel="Back"
      finish={() => {
        void updateSave(current => ({ ...current, story: seeScene(current.story, reportScene) }))
          .finally(() => setReportScene(null))
      }} />
  }
  const activeScene = active && save ? questScene(save, active) : undefined
  if (loaded && active && activeScene) return <CampaignScene key={activeScene} loaded={loaded} sceneId={activeScene}
    squad={save?.expedition?.members.flatMap(member => member.role === 'uma' ? [member.outfit] : [])}
    battle={async (id, effects) => {
      const chapter = Object.values(loaded.book.story.chapters).find((c) => c.scenes.some((scene) => scene.id === active.scene))
      const mission = chapter?.missions.find((m) => m.id === active.encounter && m.id === id)
      const training = mission?.scenario === 'training' && chapter && (mission.fixedSquad ?? chapter.leads).length === 1
      if (!chapter || !mission || (!training && !loaded.book.commands.has(id) && !loaded.book.ground.has(id))) {
        setError('This release is missing the encounter.')
      } else {
        await updateSave((s) => beginCampaignEncounter(s, loaded.book, active, chapter, mission, effects, s.campaignSupply?.port ?? supply?.port))
        setGroundPaused(false)
      }
      setActive(null)
    }}
    finish={(effects) => {
      setSavingScene(true)
      void updateSave((s) => finishCampaignDialogue(s, loaded.book, active, effects, s.campaignSupply?.port ?? supply?.port))
        .finally(() => { setActive(null); setSavingScene(false) })
    }}
    fail={(message) => { setError(message); setActive(null) }} />

  const pairScene = pendingPair && pairs.find((pair) => pair.id === pendingPair.pair)
  if (loaded && save && pendingPair && pairScene && !error && loaded.book.scenes.has(pendingPair.scene)
    && pairSceneReady(save, loaded.book, pairScene, pendingPair.scene)) {
    return <CampaignScene key={pendingPair.scene} loaded={loaded} sceneId={pendingPair.scene} fail={setError}
      finish={(effects) => commitScene((s) => closePairScene(s, loaded.book, pairScene, pendingPair.scene, effects))} />
  }
  if (loaded && save && pairScene && postponeLockedHomeScene(save, loaded.book, pairScene) !== save) {
    return <main className={viewport} style={insets}>
      <p className="mb-3 text-sm">Share two evenings before discussing a move ashore.</p>
      <button type="button" className={button} onClick={() => commitScene((s) => postponeLockedHomeScene(s, loaded.book, pairScene))}>Return to campaign</button>
    </main>
  }

  function settleDay(s: Save, campaignDay: CampaignDay): Save {
    return supply && loaded ? settleCampaignDay(s, campaignDay, loaded.book) : { ...s, campaignDay }
  }
  if (loaded && save && night?.kind === 'cabin' && !error && loaded.book.scenes.has(night.scene)) {
    const invite = night.plan.invitation, dayNumber = save.campaignDay.day
    const decision: SceneDecision | undefined = night.phase === 'invitation' && invite ? {
      selected: night.choice ?? undefined,
      commit: async (index) => {
        let accepted = false
        await updateSave((s) => {
          const next = chooseCabinOutcome(s, loaded.book, dayNumber, night, index)
          const p = next.campaignDay.pending
          accepted = next !== s || (p?.kind === 'cabin' && p.id === night.id && p.phase === 'invitation' && p.round === night.round
            && s.campaignDay.day === dayNumber && (index === invite.wait && p.outcome === null || p.outcome !== null && p.choice === index))
          return accepted ? { ...next } : s // Also retries a failed device write before continuing the branch.
        })
        if (!accepted) throw new Error('This choice is unavailable. You can leave tonight.')
      },
    } : undefined
    return <CampaignScene key={`${dayNumber}:${night.id}:${night.phase}:${night.scene}:${night.round}`} loaded={loaded} sceneId={night.scene}
      fail={setError} decision={decision}
      placeLabel={night.phase === 'morning' && night.outcome === 'leave' ? 'Personal call' : night.plan.location === 'ashore' ? 'Home visit' : 'Cabin aboard'}
      onExit={night.phase === 'bed' ? () => commitScene(s => leaveCabinEarly(s, dayNumber, night)) : undefined}
      finish={(effects) => commitScene(s => finishCabinScene(s, loaded.book, dayNumber, night, effects))} />
  }
  const nightPair = night && 'pair' in night ? pairs.find((pair) => pair.id === night.pair) : undefined
  const nightSector = night && 'pair' in night ? loaded?.book.sectors?.find((sector) => sectorNightId(sector) === night.pair
    && (sector.shared?.visit === night.scene || sector.shared?.morning === night.scene)) : undefined
  const nightDate = night && 'companion' in night
    ? loaded?.book.dates?.find((date) => date.companion === night.companion && dateScene(date, night.scene)) : undefined
  if (loaded && day && night && night.kind !== 'cabin' && !error && loaded.book.scenes.has(night.scene) && (!('pair' in night) || nightPair || nightSector)) {
    const dateDecision: SceneDecision | undefined = nightDate && night.kind === 'visit' ? { kind: 'path',
      selected: night.pathChoice === undefined ? undefined : night.pathChoice === 'heart' ? 1 : 0,
      commit: async (index) => {
        const path = index === 1 ? 'heart' : 'trust'
        let accepted = false
        await updateSave(s => {
          const next = chooseDatePath(s, loaded.book, nightDate, day.day, night.scene, path)
          const pending = next.campaignDay.pending
          accepted = pending?.kind === 'visit' && next.campaignDay.day === day.day && pending.scene === night.scene
            && pending.companion === nightDate.companion && pending.pathChoice === path
          return accepted ? { ...next } : s
        })
        if (!accepted) throw new Error('This relationship choice is unavailable.')
      } } : undefined
    return <CampaignScene key={`${day.day}:${night.kind}:${night.scene}`} loaded={loaded} sceneId={night.scene}
      fail={setError} captainDate={!!nightDate} decision={dateDecision}
      finish={(effects, bondEffects) => (nightPair || nightDate || nightSector ? commitScene : updateSave)((s) => {
        const campaignDay = finishCampaignNightScene(s.campaignDay, day.day, night)
        if (campaignDay === s.campaignDay) return s
        const next = nightPair ? recordPairScene(s, loaded.book, nightPair, night.scene, effects)
          : nightDate ? recordDateScene(s, loaded.book, nightDate, night.scene, effects, bondEffects) : reduceEffects(s, effects)
        return settleDay(nightSector ? { ...next, story: seeScene(next.story, night.scene) } : next, campaignDay)
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

  if (!expedition && location && loaded && save && managementAt(save, loaded.book)) {
    const room = loaded.book.management?.locations.find(({ id }) => id === location)
    if (room && locationAvailable(save, loaded.book, room)) return <Suspense fallback={<div className={viewport}>Opening location…</div>}>
      <LocationScreen key={room.id} loaded={loaded} save={save} location={room} back={() => setLocation(null)}
        error={error} />
    </Suspense>
  }

  const recruits = loaded && save && complete.has(loaded.book.opening) && !night && !pendingPair && !missionState && !eveningOpen && !expedition
    ? loaded.book.recruits ?? [] : []
  const managedQuests = new Set(recruits.flatMap(({ outfit, signOn, story }) => [signOn, ...story, ...rehabilitationQuestIds(catalog?.arcs.get(outfit))]))
  const available = loaded && save ? loaded.book.quests.filter((q) => !managedQuests.has(q.id) && questAvailable(save, loaded.book, q, supply?.port)) : []
  const evening = loaded?.book.evening
  const canRest = !expedition && !!(day && !night && !pendingPair && !missionState && evening && complete.has(evening.after))
  const supplyPanel = !expedition && loaded && save && supply && network && port && support && !night && !pendingPair && !missionState && !eveningOpen
    ? <SupplyPanel save={save} network={network} supply={supply} port={developedPort(loaded.book, save, port)} worlds={loaded.book.story.worlds}
      upkeep={campaignUpkeep(loaded.book, save, support.ashore)} /> : null
  const basePanels = !expedition && loaded && save && port && !night && !pendingPair && !missionState && !eveningOpen ? pairs.flatMap((pair) => {
    const home = pair.home
    if (!home || home.port !== port.id || !complete.has(home.base)) return []
    return [<HomePanel key={pair.id} pair={pair} home={home} name={port.name} story={save.story} pack={loaded.book.story}
      next={nextHomeScene(save, loaded.book, pair)} defended={complete.has(home.defense)}
      open={(scene) => commitScene((s) => openPairScene(s, loaded.book, pair, scene))} />]
  }) : []
  const pairPanels = !expedition && loaded && save && !night && !pendingPair && !missionState && !eveningOpen ? pairs.filter((pair) =>
    !pair.members.some(({ outfit }) => support?.ashore.has(outfit))).map((pair) => (
    <PairPanel key={pair.id} pair={pair} story={save.story} pack={loaded.book.story} book={loaded.book} assets={loaded.assets}
      open={(scene) => commitScene((s) => openPairScene(s, loaded.book, pair, scene))} />
  )) : []
  const datePanel = !expedition && loaded && save && dates.length > 0 && !night && !pendingPair && !missionState && !eveningOpen
    ? <DatePanel save={save} book={loaded.book} dates={dates} /> : null
  const workshop = loaded?.book.workshop
  const workshopPanel = !expedition && loaded && save && support && workshop && !night && !pendingPair && !missionState && !eveningOpen
    && workshop.port === port?.id && complete.has(workshop.after)
    ? <Suspense fallback={null}><WorkshopPanel save={save} loaded={loaded} ashore={support.ashore} /></Suspense> : null
  const side = supplyPanel || datePanel || pairPanels.length + basePanels.length > 0
  const visitOptions = canRest ? evening?.visits.filter((v) => !support?.ashore.has(v.companion) && save?.crew.some((crew) => crew.outfit === v.companion)) ?? [] : []
  const dateOptions = loaded && save && canRest ? dates.map((date) => {
    const visit = dateProgress(save, loaded.book, date).visit
    const cabin = visit === date.regular ? loaded.book.cabinEvenings?.find(c => 'companion' in c.source && c.source.companion === date.companion) : undefined
    return { visit: { kind: 'visit' as const, companion: date.companion, scene: visit.scene, morning: visit.morning }, title: visit.title, cabin }
  }) : []
  const sharedCabins = loaded && save && canRest ? loaded.book.cabinEvenings?.filter(c => !('companion' in c.source) && cabinAvailable(save, loaded.book, c)) ?? [] : []
  function chooseCabin(cabin: CabinEvening) {
    if (!loaded || !day || !canRest) return
    setEveningOpen(false)
    commitScene(s => startCabinEvening(s, loaded.book, cabin, day.day))
  }
  const pairVisits = loaded && save && canRest ? pairs.flatMap((pair) => {
    const visit = pairVisit(pair, save.story, save.crew.flatMap(({ outfit }) => support?.ashore.has(outfit) ? [] : [outfit]))
    if (!visit) return []
    const shared = availableSharedVisit(save, pair)
    const progress = pairProgress(pair, save.story)
    const [first, second] = pair.members.map(({ outfit }) => nameOf(loaded.book.story, outfit))
    const label = !progress.released ? `Visit ${second} in the brig` : progress.residency === 'shared' ? `Visit ${first} and ${second}` : `Visit ${second}’s cabin`
    return shared ? [{ visit: shared, label: `Share an evening with ${first} and ${second}` }, { visit, label }] : [{ visit, label }]
  }) : []
  const sectorVisits = loaded && save && canRest ? (loaded.book.sectors ?? []).flatMap((sector) => {
    const visit = sectorVisit(loaded.book, save, sector)
    return visit ? [{ visit, label: `Share an evening with ${nameOf(loaded.book.story, sector.officer)} and ${nameOf(loaded.book.story, sector.former!.speaker)}` }] : []
  }) : []
  function chooseEvening(visit: CampaignVisit | null) {
    setEveningOpen(false)
    void (visit ? commitScene : updateSave)((s) => {
      if (!canRest || s.campaignDay.day !== day?.day || s.pairScene || s.mission) return s
      if (!loaded) return s
      const { ashore } = campaignSupport(loaded.book, s)
      if (visit?.kind === 'visit' && !s.crew.some((crew) => crew.outfit === visit.companion)) return s
      if (visit?.kind === 'visit' && loaded) {
        const date = loaded.book.dates?.find(({ companion }) => companion === visit.companion)
        if (date) {
          if (!dateAvailable(s, loaded.book, date)) return s
          const ready = dateProgress(s, loaded.book, date).visit
          if (ready.scene !== visit.scene || ready.morning !== visit.morning) return s
        } else if (ashore.has(visit.companion)) return s
      }
      if (visit?.kind === 'pair-visit') {
        const sector = loaded.book.sectors?.find((row) => sectorNightId(row) === visit.pair)
        if (sector) {
          const eligible = sectorVisit(loaded.book, s, sector)
          if (!eligible || eligible.scene !== visit.scene || eligible.morning !== visit.morning) return s
          return settleDay(s, startCampaignNight(s.campaignDay, visit))
        }
        const pair = loaded?.book.pairs.find((pair) => pair.id === visit.pair)
        if (!pair || !loaded || !pairAvailable(s, loaded.book, pair)) return s
        const cabin = pairVisit(pair, s.story, s.crew.flatMap(({ outfit }) => ashore.has(outfit) ? [] : [outfit]))
        if (![cabin, availableSharedVisit(s, pair)].some((option) => option?.scene === visit.scene && option.morning === visit.morning)) return s
      }
      const campaignDay = startCampaignNight(s.campaignDay, visit)
      return campaignDay === s.campaignDay ? s : settleDay(s, campaignDay)
    })
  }
  return (
    <main className={viewport} style={insets} data-campaign data-campaign-release={loaded?.release.release}>
      <div className={side ? 'mx-auto grid max-w-5xl items-start gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]' : 'mx-auto max-w-xl'}>
        <div className="space-y-3">
          <header className="flex items-center justify-between gap-2">
            <h1 className="font-display text-xl font-bold">Campaign</h1>
            <Link to={campaignAccount} className={button}>Account</Link>
          </header>
          {error && !pending && <button type="button" className={button} onClick={() => setCheck(n => n + 1)}>Try again</button>}
          {loaded && save && complete.has(loaded.book.opening) && loaded.book.tiers?.map((tier, index) => {
            const prior = loaded.book.tiers?.[index - 1]?.core
            if (index > 0 && (!prior || !complete.has(prior.settles))) return null
            const captures = campaignCaptures(tier, save)
            return <section key={tier.number} aria-label={`Tier ${tier.number} captures`} className="rounded-lg border border-white/15 p-2 text-sm">
              <p className="font-semibold">Tier {tier.number} · {captures}/{CORE_CAPTURES} captures</p>
              <p className="mt-1 text-white/75">{complete.has(tier.signal) ? 'Signal heard' : `Signal at ${SIGNAL_CAPTURES} captures`}</p>
              {tier.core && <p className="text-white/75">{complete.has(tier.core.settles) ? 'Core cleared' : `Core at ${CORE_CAPTURES} captures`}</p>}
            </section>
          })}
          {expedition && loaded && <section aria-label="Active expedition" className="space-y-1 rounded-lg border border-white/15 p-2 text-sm">
            <h2 className="font-semibold">{loaded.book.fourAct?.duos.get(expedition.duo)?.expedition?.route?.name ?? expedition.ship}</h2>
            <p>{expedition.members.length} aboard · {expedition.fuel} fuel · {expedition.provisions} provisions</p>
            {save && (() => {
              const watch = expeditionWatchScene(save, loaded.book, complete)
              return watch && <button type="button" className={button} onClick={() => setReportScene(watch.scene)}>
                {watch.shortfall ? 'Supply report' : 'Off duty'}
              </button>
            })()}
          </section>}
          {loaded && expeditions && expeditions.length > 0 && complete.has(loaded.book.opening) && <section
            className="space-y-2 rounded-lg border border-white/15 p-2 text-sm" aria-label="Expedition readiness">
            <h2 className="font-semibold">Expedition readiness</h2>
            <p>Capitals · {expeditions[0]!.readiness.capitals}/5</p>
            <ul>{expeditions.map(({ duo, readiness }) => <li key={duo.id}>
              {duo.umas.map(outfit => nameOf(loaded.book.story, outfit)).join(' & ')} · {readiness.returned}/6 returned
              {duo.expedition?.route && save && !expedition && !complete.has(duo.expedition.route.launch) &&
                <p className="text-white/70">Departure · {duo.expedition.route.cargo.fuel} fuel · {duo.expedition.route.cargo.provisions} provisions</p>}
              {duo.expedition?.route && save && !expedition && (() => {
                const launch = loaded.book.quests.find(q => q.id === duo.expedition?.route?.launch)!
                const issue = expeditionQuestBlock(save, loaded.book, launch.id, duo, q => complete.has(q.id))
                return issue && !complete.has(launch.id) ? <p className="text-white/70">{issue}</p> : null
              })()}
              {duo.expedition && <p className="text-white/70">Generals cleared · {readiness.cleared}/2</p>}
              {duo.local && complete.has(duo.local.base) && <p className="text-white/70">Liberation base active</p>}
              {readiness.ready && duo.expedition && <details><summary className="min-h-11">Expedition crew · 10</summary>
                <ul>{duo.expedition.members.map(member => {
                  const actor = member.role === 'uma' ? member.outfit : member.heroine
                  return <li key={actor}>{nameOf(loaded.book.story, actor)}</li>
                })}</ul>
              </details>}
              {duo.returns.length > 0 && <details><summary className="min-h-11">Lieutenants</summary>
                <ul>{duo.returns.map(row => <li key={row.heroine}>{nameOf(loaded.book.story, row.heroine)} · {complete.has(row.quest) && (!row.operation || complete.has(row.operation)) ? 'Returned' : 'Pending'}</li>)}</ul>
              </details>}
            </li>)}</ul>
          </section>}
          {day && <p className="text-sm text-white/65">Day {day.day}</p>}
          {pending && <p role="status">Checking the release…</p>}
          {error && <p role="alert" className="break-words text-[#ffa7b7]">{error}</p>}
          {(night || pendingPair) && !pending && !error && <p role="alert" className="text-[#ffa7b7]">This release is missing the saved scene.</p>}
          {supply && !port && <p role="alert" className="text-[#ffa7b7]">This release is missing the saved port.</p>}
          {missionState && (training || ground) && <button type="button" className={button} onClick={() => setGroundPaused(false)}>Resume {ground?.title ?? 'Training'}</button>}
          {missionState && optionalTraining && <button type="button" className={button} onClick={() => void updateSave((s) =>
            s.mission === missionState ? { ...s, mission: null } : s
          )}>Leave Training</button>}
          {missionState && loaded && !training && !ground && <p role="alert" className="text-[#ffa7b7]">This release is missing the saved encounter.</p>}
          {save && !night && !pendingPair && !missionState && available.map((quest) => <button key={quest.id} type="button" onClick={() => setActive(quest)}
            className="block min-h-11 w-full rounded-lg bg-[#2ee6ff] px-4 text-left font-bold text-[#0b0d17]">{quest.title}</button>)}
          {loaded && save && recruits.length > 0 && <RecruitmentPanel save={save} book={loaded.book} assets={loaded.assets}
            recruits={recruits} port={port?.id} open={setActive} />}
          {loaded && save && !expedition && !eveningOpen && managementAt(save, loaded.book) && <section aria-label="Ship and port" className="space-y-2">
            <h2 className="font-display text-lg font-bold">Ship and port</h2>
            <div className="grid grid-cols-2 gap-2">
              {loaded.book.management?.locations.filter(room => locationAvailable(save, loaded.book, room)).map(room =>
                <button key={room.id} type="button" className={button} onClick={() => setLocation(room.id)}>
                  {room.title}<span className="ml-2 text-xs capitalize text-white/60">{locationState(save, loaded.book, room)}</span>
                </button>)}
            </div>
          </section>}
          {canRest && !eveningOpen && <button type="button" className={button} onClick={() => setEveningOpen(true)}>End day</button>}
          {canRest && eveningOpen && loaded && <section aria-label="Evening" className="flex flex-wrap gap-2">
            {visitOptions.map((visit) => <button key={visit.companion} type="button" className={button}
              onClick={() => chooseEvening({ kind: 'visit', ...visit })}>Visit {nameOf(loaded.book.story, visit.companion)}</button>)}
            {dateOptions.map(({ visit, title, cabin }) => <button key={visit.companion} type="button" className={button}
              onClick={() => cabin ? chooseCabin(cabin) : chooseEvening(visit)}>{nameOf(loaded.book.story, campaignSpeaker(loaded.book.allies, visit.companion))} · {title}</button>)}
            {sharedCabins.map(cabin => {
              const source = cabin.source
              if ('trio' in source) {
                const ally = loaded.book.allies?.find(row => row.heroine === source.trio)
                return ally && <button key={cabin.id} type="button" className={button} onClick={() => chooseCabin(cabin)}>
                  Evening with {nameOf(loaded.book.story, ally.partner)} and {nameOf(loaded.book.story, ally.heroine)}
                </button>
              }
              const officer = 'sector' in source ? loaded.book.sectors?.find(s => s.id === source.sector)?.officer
                : 'pair' in source ? loaded.book.pairs.find(p => p.id === source.pair)?.members[0].outfit : undefined
              return <button key={cabin.id} type="button" className={button} onClick={() => chooseCabin(cabin)}>Shared cabin evening · {officer ? nameOf(loaded.book.story, officer) : 'Crew'}</button>
            })}
            {[...pairVisits, ...sectorVisits].map(({ visit, label }) => <button key={visit.scene} type="button" className={button} onClick={() => chooseEvening(visit)}>{label}</button>)}
            <button type="button" className={button} onClick={() => chooseEvening(null)}>My quarters</button>
            <button type="button" className={button} onClick={() => setEveningOpen(false)}>Back</button>
          </section>}
          {loaded && !pending && !night && !pendingPair && !missionState && !canRest && !supply && available.length === 0 && <p className="text-white/65">You’re caught up.</p>}
        </div>
        {side && <div className="space-y-3">
          {loaded && save && port && !night && !pendingPair && !missionState && !eveningOpen && <SectorPanel book={loaded.book} save={save} />}
          {loaded?.book.projects?.length && save && port && !expedition && !night && !pendingPair && !missionState && !eveningOpen
            ? <ProjectsPanel book={loaded.book} save={save} port={port} showReport={setReportScene} /> : null}
          {loaded?.book.finale && save && supply && !night && !pendingPair && !missionState && !eveningOpen &&
            <FinalePanel book={loaded.book} story={save.story} complete={complete.has(loaded.book.finale.lastWatch ?? loaded.book.finale.ending)} />}
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
