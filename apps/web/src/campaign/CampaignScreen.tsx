import type { SceneDecision } from '../story/ScenePlayer'
import {
  awayMembers, campaignCaptures, campaignSpeaker, campaignSupport, campaignUpkeep, CORE_CAPTURES, crewSpeaker, developedPort, expeditionReadiness, finaleAllies, finishCampaignNightScene, fleetMobilized, homeOutcome, moduleAt, pairProgress, pairVisit, reactorPips, rehabilitationQuestIds, seeScene, SIGNAL_CAPTURES,
  cancelStationAppointment, sectorNightId, sectorVisit, setFlag, startCampaignNight, startSupply, stationDate, stationRoom, STATION_MODULES,
  type CabinEvening, type CampaignAlly, type CampaignDate, type CampaignDay, type CampaignQuest, type CampaignReleaseFile, type CampaignVisit, type EffectStep, type Save, type Speaker, type StationModule,
} from '@cyber/domain'
import { ContentError } from '@luismlorenzana/uma-kit/content'
import { TurnedStage, type StageLayout } from '@luismlorenzana/uma-stage'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
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
import { ShipHome, homeAreas, type HomeArea } from './ShipHome'
import { campaignControl, campaignPrimary } from './CampaignQuestRow'
import { careLeadAway, carePort, isCareSession } from './appointments'
import { closeRecruitment, homestretchCabins, homeQuestTravel, travelForHomeQuest } from './homestretch'
import { combatReadiness, indexCampaignNavigation, type OperationBrowse, type RosterBrowse } from './navigation'
import { initializeCampaignCurve } from './progression'
import { salvageDeployment, startSalvage } from './salvage'
import { workshopAt } from './workshop'
import { SectorPanel } from './SectorPanel'
import { ProjectsPanel } from './ProjectsPanel'
import { SupplyPanel } from './SupplyPanel'
import { advanceStationWatches, cutterArrival, settleCampaignDay, stationOf, voyageCrew } from './watch'
import { chooseDatePath, creditCampaignDates, dateAvailable, dateProgress, dateScene, recordDateScene } from './dates'
import { DatePanel } from './DatePanel'
import { ExpeditionLaunchReview, ExpeditionPanel } from './ExpeditionPanel'
import { expeditionForQuest, expeditionPlan, expeditionQuestBlock } from './expedition'
import { beginCampaignEncounter } from './sortie'
import { finaleActivities, finaleFormations, finaleReadiness, finaleRepairOptions, finaleRun, finaleVoices,
  finishFinaleActivity, selectFinaleFormation, selectFinaleVoice, workFinaleRepair } from './cy90'
import { cabinVisitors, canBookNightContact, checkInWithLieutenant, closeNight, contactDay, enterNight, finishNightContact,
  nextQueuedMorning, nightActive, nightVisitsLeft, spendNightContact, visitActors, watchesUntilNight } from './night-economy'
import { cabinAvailable, chooseCabinOutcome, finishCabinScene, finishSharedConsent, leaveCabinEarly, sharedConsentOffer, startCabinEvening } from './cabins'

const button = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-white/10 px-4 text-sm font-semibold text-white'
const viewport = 'absolute inset-0 overflow-y-auto bg-[#0b0d17] px-4 py-3 text-[#e8ebf5]'
const insets = { margin: 'var(--inset-top) var(--inset-right) var(--inset-bottom) var(--inset-left)' }
const GroundScreen = lazy(() => import('./GroundScreen'))
const ShipCommandScreen = lazy(() => import('./ShipCommandScreen'))
const WorkshopPanel = lazy(() => import('./WorkshopPanel'))
const LocationScreen = lazy(() => import('./LocationScreen'))
const RosterScreen = lazy(() => import('./RosterScreen'))
const OperationsScreen = lazy(() => import('./OperationsScreen'))
const RecruitCrew = lazy(() => import('./RecruitCrew'))
const StationHome = lazy(() => import('./StationHome'))
const StationCalendar = lazy(() => import('./StationCalendar'))
const StationCabins = lazy(() => import('./StationCabins'))
const StationFleet = lazy(() => import('./StationFleet').then(module => ({ default: module.StationFleet })))
const StationCare = lazy(() => import('./StationCare').then(module => ({ default: module.StationCare })))
const Squads = lazy(() => import('../crew/SquadsPanel').then(module => ({ default: module.SquadsPanel })))
const campaignViews = ['Home', 'Roster', 'Operations'] as const
type CampaignView = typeof campaignViews[number] | 'Recruit' | 'Calendar'
type Invitation = { outfit: number; quest: CampaignQuest; release: string; scene: string; effects: readonly EffectStep[] }

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
  const sceneRelease = save?.salvage?.active?.release ?? (save?.station?.recruit || save?.campaignDay.pending || save?.station?.night?.mornings.length
    ? save.station?.sceneRelease : undefined)
  const [loaded, setLoaded] = useState<LoadedCampaign | null>(null)
  const [location, setLocation] = useState<string | null>(null)
  const [groundReports, setGroundReports] = useState<{ scene: string; squad: readonly number[] }[]>([])
  const [reportScene, setReportScene] = useState<string | null>(null)
  const [finaleScene, setFinaleScene] = useState<string | null>(null)
  const [sharedConsent, setSharedConsent] = useState<{ ally: CampaignAlly; quest: CampaignQuest; day: number } | null>(null)
  const [active, setActive] = useState<CampaignQuest | null>(null)
  const [launchReview, setLaunchReview] = useState<CampaignQuest | null>(null)
  const [stationScene, setStationScene] = useState<{ scene: string; flag?: string; after?: () => void } | null>(null)
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [newRecruit, setNewRecruit] = useState<number>()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(true)
  const [check, setCheck] = useState(0)
  const [eveningOpen, setEveningOpen] = useState(false)
  const [eveningRole, setEveningRole] = useState<'Uma' | 'General' | 'Lieutenant' | 'Shared'>('Uma')
  const [eveningSearch, setEveningSearch] = useState('')
  const [groundPaused, setGroundPaused] = useState(false)
  const [savingScene, setSavingScene] = useState(false)
  const [view, setView] = useState<CampaignView>('Home')
  const [portTarget, setPortTarget] = useState<string>()
  const [homeArea, setHomeArea] = useState<HomeArea>('Deck')
  const [stationFocus, setStationFocus] = useState<{
    deck?: typeof STATION_MODULES[StationModule]['deck']; room?: StationModule; zoom: number
  }>({ zoom: 1 })
  const [rosterBrowse, setRosterBrowse] = useState<RosterBrowse>({ kind: 'Uma', search: '', page: 0 })
  const [operationBrowse, setOperationBrowse] = useState<OperationBrowse>({ type: 'All', act: 'All acts', state: 'Ready', search: '', page: 0 })
  const screen = useRef<HTMLElement>(null)
  const restoredRecruit = useRef(false)
  const loadedFor = useRef<{ owner: typeof owner; check: number; pinned?: string; release: string } | undefined>(undefined)
  const invitationChoice = useRef<number | undefined>(undefined)
  const complete = useMemo(() => new Set(save && loaded ? loaded.book.quests.filter(q => questComplete(save, q, loaded.book)).map(q => q.id) : []), [save, loaded])
  const navigation = useMemo(() => loaded && indexCampaignNavigation(loaded.book), [loaded])
  function selectView(next: CampaignView, area: HomeArea = 'Deck') {
    setNewRecruit(undefined)
    setView(next)
    setHomeArea(area)
    setEveningOpen(false)
    screen.current?.scrollTo(0, 0)
  }
  useEffect(() => {
    const previous = loadedFor.current
    if (previous && previous.owner === owner && previous.check === check
      && (sceneRelease ? previous.release === sceneRelease : !previous.pinned)) return
    let live = true
    setPending(true)
    setError(null)
    loadCampaign(undefined, owner ?? undefined, campaignIdentity, sceneRelease).then((value) => {
      if (!live) return
      loadedFor.current = { owner, check, pinned: sceneRelease, release: value.release.release }
      setLoaded(value)
    }, (err: unknown) => {
      if (live) setError(err instanceof ContentError && err.status === 404 ? 'Campaign release unavailable.'
        : err instanceof Error ? err.message : String(err))
    }).finally(() => { if (live) setPending(false) })
    return () => { live = false }
  }, [check, owner, sceneRelease])
  useEffect(() => {
    if (loaded && save) void updateSave((current) => creditCampaignDates(initializeCampaignCurve(current, loaded.book), loaded.book))
  }, [loaded, save])
  useEffect(() => {
    if (restoredRecruit.current || !loaded || !save || sceneRelease && loaded.release.release !== sceneRelease) return
    restoredRecruit.current = true
    const selected = save.station?.recruit && navigation?.quests.get(save.station.recruit)
    if (selected && loaded.book.recruits?.some(row => row.signOn === selected.id)
      && questAvailable(save, loaded.book, selected, save.campaignSupply?.port ?? loaded.book.supply?.start)) {
      setView('Recruit')
      setActive(selected)
    }
  }, [loaded, navigation, save, sceneRelease])
  function commitScene(change: (save: Save) => Save) {
    setSavingScene(true)
    void updateSave(change).finally(() => setSavingScene(false))
  }
  if (savingScene) return <div className={viewport} style={insets} role="status">Saving…</div>
  if (sceneRelease && loaded && sceneRelease !== loaded.release.release && !error) {
    return <div className={viewport} style={insets} role="status">Resuming scene…</div>
  }
  function openCrew(outfit: number) {
    setRosterBrowse({ kind: 'Uma', search: '', page: 0, selected: outfit, tab: 'Story' })
    selectView('Roster')
  }
  function showStationStory(key: string, after?: () => void, repeat = false): boolean {
    const scene = loaded?.book.stationStory?.transition.get(key)
    if (!scene || !save || (!repeat && useGame.getState().save?.story.seen.includes(scene))) return false
    setStationScene({ scene, after })
    return true
  }
  function startRecruitTrip(quest: CampaignQuest) {
    if (!loaded || !save) return
    const trip = homeQuestTravel(save, loaded.book, quest)
    const example = loaded.book.stationStory?.opening
    const signOn = loaded.book.recruits?.find(row => row.signOn === quest.id)
    const travel = () => void meetQuest(quest)
    if (trip?.affordable && trip.watches > 0 && signOn && signOn.outfit === example?.actor && trip.destination === example.port) {
      const depart = () => { if (!showStationStory('depart', travel)) travel() }
      if (!showStationStory('call', depart)) depart()
    } else travel()
  }
  function deferInvitation(offer: Invitation) {
    void updateSave(s => closeRecruitment(s, offer.quest.id))
    setInvitation(null)
    setError(null)
  }
  async function meetQuest(quest: CampaignQuest) {
    if (!loaded || savingScene) return
    setSavingScene(true)
    setError(null)
    try {
      await updateSave(current => travelForHomeQuest(current, loaded.book, quest, loaded.release.release))
      const now = useGame.getState().save
      const arrival = now && homeQuestTravel(now, loaded.book, quest)
      if (!arrival || arrival.fuel !== 0) {
        setError('Check the available route and fuel.')
        return
      }
      setNewRecruit(undefined)
      setActive(quest)
    } catch {
      setError('Could not save the trip. Try again.')
    } finally {
      setSavingScene(false)
    }
  }
  async function inviteAboard(offer: Invitation) {
    if (!loaded || savingScene) return
    setSavingScene(true)
    setError(null)
    try {
      await updateSave(current => {
        if (offer.release !== loaded.release.release || questScene(current, offer.quest) !== offer.scene) return current
        const invited = finishCampaignDialogue(current, loaded.book, offer.quest, offer.effects, current.campaignSupply?.port ?? loaded.book.supply?.start)
        return invited === current ? current : closeRecruitment(cutterArrival(invited, loaded.book, offer.outfit), offer.quest.id)
      })
      if (!useGame.getState().save?.crew.some(member => member.outfit === offer.outfit)) {
        setError('The invitation expired. Meet her again to continue.')
        setInvitation(null)
        return
      }
      setInvitation(null)
      openCrew(offer.outfit)
      setNewRecruit(offer.outfit)
      if (offer.outfit === loaded.book.stationStory?.opening?.actor) showStationStory('berth-assigned')
    } catch {
      setError('Could not save the invitation. Try again.')
    } finally {
      setSavingScene(false)
    }
  }
  const reduceEffects = (s: Save, effects: readonly EffectStep[]): Save =>
    loaded ? effects.reduce((state, step) => applyStep(state, loaded.book.story, step), s) : s
  const day = save?.campaignDay
  const night = day?.pending
  const pendingPair = save?.pairScene
  const catalog = loaded?.book.fourAct
  const expeditions = view === 'Operations' && catalog ? [...catalog.duos.values()].map(duo => ({ duo, readiness: expeditionReadiness(catalog, duo.id, complete)! })) : undefined
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
  const salvage = save && salvageDeployment(save)
  const mission = salvage?.mission ?? missionChapter?.missions.find((m) => m.id === missionState?.id)
  const training = mission?.scenario === 'training'
  const trainingQuest = training ? loaded?.book.quests.find(({ encounter }) => encounter === mission.id) : undefined
  const optionalTraining = !!(trainingQuest && loaded && optionalCampaignTraining(loaded.book, trainingQuest))
  const missionQuest = mission && loaded?.book.quests.find(({ encounter }) => encounter === mission.id)
  const battleReadiness = loaded && navigation ? combatReadiness(loaded.book, navigation, missionQuest ?? undefined) : undefined
  const expeditionFight = loaded && missionQuest ? expeditionForQuest(loaded.book, missionQuest.id, save?.expedition?.duo) : undefined
  const personalLead = loaded && missionQuest ? personalMissionLead(loaded.book, missionQuest) : undefined
  const command = mission && loaded?.book.commands.get(mission.id)
  const ground = salvage?.ground ?? (mission && loaded?.book.ground.get(mission.id))
  const hush = loaded && save && ground && loaded.book.fourActFinale?.ground.includes(ground.id) ? finaleRun(save, loaded.book) : undefined
  const trainee = personalLead ?? missionState?.squad[0] ?? missionChapter?.leads[0]
  if (loaded && groundReports[0]) {
    const { scene, squad } = groundReports[0]
    const advance = () => setGroundReports(scenes => scenes.slice(1))
    return <CampaignScene key={scene} loaded={loaded} sceneId={scene} squad={squad} finish={advance} fail={advance} />
  }
  if (loaded && save && mission && (training || ground) && trainee !== undefined && !sortieAshore?.has(trainee) && !groundPaused) {
    return <Suspense fallback={<div className={viewport} style={insets} role="status">Loading mission…</div>}>
      <GroundScreen key={mission.id} loaded={loaded} save={save} mission={mission} layout={layout} trainee={trainee} label={nameOf(loaded.book.story, trainee)}
        expedition={hush ? 'Hush expedition' : expeditionFight?.expedition?.route?.name} formationRun={hush} ground={ground || undefined} pack={loaded.book.story} bossArt={ground && ground.boss ? loaded.assets.get(ground.boss.portrait) : undefined}
        combatSprites={loaded.release.combatSprites}
        combatShift={loaded.book.combatShift} readiness={battleReadiness}
        acceptsFitted={!!ground && !ground.combat && !expeditionFight && !hush && (!!loaded.book.fourAct || loaded.book.workshop?.missions.includes(mission.id))}
        ashore={sortieAshore} requiredLead={personalLead}
        editableSquad={!!ground && (!!loaded.book.sectors?.length || !!missionState?.callUp || personalLead !== undefined)}
        onSettled={(scenes, squad) => setGroundReports(scenes.map(scene => ({ scene, squad })))}
        close={() => setGroundPaused(true)} />
    </Suspense>
  }
  if (loaded && save && mission && command && supply && support) {
    const quest = missionQuest
    const bridgeAshore = missionAshore(loaded.book, save)
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
        ashore={bridgeAshore} requiredLead={personalLead} homeDefense={homeDefense} finale={finale} emitterRoute={emitterRoute} readiness={battleReadiness}
        qualifications={new Map(loaded.book.sectors?.map((sector) => [sector.officer, sector.qualification]))}
        portraits={new Map([...portraits, ...profiles])}
        names={new Map(save.crew.filter(({ outfit, heroine, expeditionOnly }) => !expeditionOnly && (personalLead === undefined || !heroine)
          && !bridgeAshore.has(outfit) && !awayMembers(save.operations, save.squads).includes(outfit)).map(member => [member.outfit, nameOf(loaded.book.story, crewSpeaker(member))]))} />
    </Suspense>
  }
  if (loaded && save && finaleScene && loaded.book.scenes.has(finaleScene)) {
    return <CampaignScene key={finaleScene} loaded={loaded} sceneId={finaleScene}
      fail={message => { setError(message); setFinaleScene(null) }} onExit={() => setFinaleScene(null)} exitLabel="Back"
      finish={effects => { commitScene(current => finishFinaleActivity(current, loaded.book, finaleScene, effects)); setFinaleScene(null) }} />
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
  if (loaded && sharedConsent) return <CampaignScene key={sharedConsent.quest.scene} loaded={loaded} sceneId={sharedConsent.quest.scene}
    fail={(message) => { setError(message); setSharedConsent(null) }}
    decision={{ commit: async index => {
      const current = useGame.getState().save
      if (index === 0 && (!current || current.campaignDay.day !== sharedConsent.day
        || !sharedConsentOffer(current, loaded.book, sharedConsent.ally))) throw new Error('This invitation is unavailable now.')
    } }}
    finish={(effects) => {
      commitScene(s => finishSharedConsent(s, loaded.book, sharedConsent.ally, sharedConsent.day, effects))
      setSharedConsent(null)
    }} />

  const speaker = save?.finaleProgress?.speaker
  const finalBook = loaded?.book.fourActFinale
  const activeScene = active && save ? questScene(save, active) : undefined
  const voice = active && finalBook && active.id === finalBook.speakerAt
    ? speaker === 'captain' ? finalBook.bridge : speaker === undefined ? undefined : finalBook.speakers.get(speaker) : undefined
  const signOn = active && loaded?.book.fourAct && loaded.book.recruits?.find(row => row.signOn === active.id)
  const portArrival = loaded && save && port && !night && !pendingPair && !missionState && !error
    && !save.story.seen.includes(port.scene) ? port : undefined
  const specialArrival = portArrival && signOn && signOn.outfit === loaded?.book.stationStory?.opening?.actor
    && portArrival.id === loaded.book.stationStory.opening.port ? loaded.book.stationStory.transition.get('arrive') : undefined
  if (loaded && save && stationScene) return <CampaignScene key={stationScene.scene} loaded={loaded} sceneId={stationScene.scene}
    fail={message => { setError(message); setStationScene(null) }} onExit={() => setStationScene(null)} exitLabel="Back"
    finish={effects => {
      setSavingScene(true)
      void updateSave(current => {
        if (stationScene.flag && current.story.flags.includes(stationScene.flag)) return current
        const next = reduceEffects(current, effects)
        const seen = seeScene(next.story, stationScene.scene)
        return { ...next, story: stationScene.flag ? setFlag(seen, stationScene.flag) : seen }
      }).then(() => {
        setStationScene(null)
        setSavingScene(false)
        stationScene.after?.()
      }, () => {
        setStationScene(null)
        setSavingScene(false)
        setError('Could not save this scene. Try again.')
      })
    }} />
  const authoredOffer = invitation && invitation.outfit === loaded?.book.stationStory?.opening?.actor
    ? loaded.book.stationStory.transition.get('offer') : undefined
  if (invitation && loaded && authoredOffer && !error) return <CampaignScene key={authoredOffer} loaded={loaded} sceneId={authoredOffer}
    decision={{ commit: async index => { invitationChoice.current = index } }}
    onExit={() => deferInvitation(invitation)} exitLabel="Defer invitation" fail={setError}
    finish={() => {
      if (invitationChoice.current === 0) void inviteAboard(invitation)
      else deferInvitation(invitation)
    }} />
  if (invitation && loaded) return <main className={viewport} style={insets} data-recruit-invitation>
    <section className="mx-auto mt-6 max-w-lg space-y-4 rounded-xl border border-cyan-200/20 bg-[#101e32] p-5" aria-labelledby="invite-title">
      <h1 id="invite-title" className="font-display text-2xl font-bold">{nameOf(loaded.book.story, invitation.outfit)}</h1>
      {error && <p role="alert" className="text-rose-200">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={campaignPrimary} onClick={() => void inviteAboard(invitation)}>Invite aboard</button>
        <button type="button" className={campaignControl} onClick={() => deferInvitation(invitation)}>Back</button>
      </div>
    </section>
  </main>
  const launchDuo = loaded && launchReview && expeditionForQuest(loaded.book, launchReview.id)
  if (loaded && save && launchReview && launchDuo) {
    const ready = questAvailable(save, loaded.book, launchReview, port?.id) && !save.mission && !save.campaignDay.pending && !save.pairScene
    const block = ready ? undefined : expeditionQuestBlock(save, loaded.book, launchReview.id, launchDuo, q => complete.has(q.id)) ?? 'Finish the pending campaign activity'
    return <main key={launchReview.id} className={viewport} style={insets}>
      <ExpeditionLaunchReview book={loaded.book} save={save} duo={launchDuo} complete={complete} block={block}
        launch={() => { if (ready) { setLaunchReview(null); setActive(launchReview) } }}
        cargo={() => { setLaunchReview(null); selectView('Home', 'Cargo') }}
        back={() => setLaunchReview(null)} />
    </main>
  }
  if (loaded && active && activeScene
    && !(signOn && portArrival && active.port === portArrival.id && activeScene !== portArrival.scene)) return <CampaignScene
    key={voice ?? activeScene} loaded={loaded} sceneId={voice ?? activeScene}
    onExit={signOn ? () => {
      void updateSave(s => closeRecruitment(s, active.id))
      setActive(null)
    } : undefined}
    exitLabel={signOn ? 'Leave meeting' : undefined}
    squad={(save?.expedition ?? (save && active.id.startsWith('fa-finale-') ? finaleRun(save, loaded.book) : undefined))
      ?.members.flatMap(member => member.role === 'uma' ? [member.outfit] : [])}
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
      if (signOn) {
        invitationChoice.current = undefined
        setInvitation({ outfit: signOn.outfit, quest: active, scene: activeScene, release: loaded.release.release, effects })
        setActive(null)
        return
      }
      setSavingScene(true)
      void updateSave((s) => {
        const next = finishCampaignDialogue(s, loaded.book, active, effects, s.campaignSupply?.port ?? supply?.port)
        return next !== s && next.station ? { ...next, station: cancelStationAppointment(next.station, { quest: active.id }) } : next
      }).then(() => {
        const pilot = loaded.book.stationStory?.opening?.actor
        const current = useGame.getState().save
        if (pilot && current && loaded.book.fourAct?.arcs.get(pilot)?.capture?.custody === active.id
          && questComplete(current, active, loaded.book)) showStationStory('intake')
      })
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

  function pinEvening(s: Save): Save {
    if (!loaded?.book.stationStory || !s.campaignDay.pending) return s
    const station = stationOf(s, loaded.book)
    if (station.sceneRelease === loaded.release.release) return s
    return { ...s, station: { ...station, sceneRelease: loaded.release.release } }
  }
  function settleDay(s: Save, campaignDay: CampaignDay): Save {
    return pinEvening(supply && loaded ? settleCampaignDay(s, campaignDay, loaded.book) : { ...s, campaignDay })
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
        const recorded = nightSector ? { ...next, story: seeScene(next.story, night.scene) } : next
        if (!loaded.book.stationStory) return settleDay(recorded, campaignDay)
        if (night.kind === 'morning' || night.kind === 'pair-morning') return nextQueuedMorning(recorded)
        return finishNightContact(recorded, loaded.book, visitActors(loaded.book, night,
          nightSector ? [nightSector.officer, nightSector.former!.speaker] : undefined), campaignDay.pending)
      })} />
  }
  if (loaded && portArrival) {
    return <CampaignScene key={specialArrival ?? portArrival.scene} loaded={loaded} sceneId={specialArrival ?? portArrival.scene} fail={setError}
      finish={(effects) => void updateSave((s) => {
        if (s.story.seen.includes(portArrival.scene)) return s
        const next = reduceEffects(s, effects)
        const arrived = seeScene(next.story, portArrival.scene)
        return { ...next, story: specialArrival ? seeScene(arrived, specialArrival) : arrived }
      })} />
  }

  if (!expedition && location && loaded && save && managementAt(save, loaded.book)) {
    const room = loaded.book.management?.locations.find(({ id }) => id === location)
    if (room && locationAvailable(save, loaded.book, room)) return <Suspense fallback={<div className={viewport}>Opening location…</div>}>
      <LocationScreen key={room.id} loaded={loaded} save={save} location={room} back={() => setLocation(null)}
        error={error} />
    </Suspense>
  }

  const opened = !!loaded && complete.has(loaded.book.opening)
  const insideEvening = !!save && nightActive(save)
  const showingEvening = eveningOpen || insideEvening
  const menuReady = opened && !night && !pendingPair
  const currentView = menuReady && !missionState && !insideEvening ? view : 'Home'
  const bridge = currentView === 'Home' && !insideEvening && (!menuReady || homeArea === 'Deck' || homeArea === 'Bridge' || !!missionState)
  const deck = menuReady && currentView === 'Home' && homeArea === 'Deck' && !insideEvening && !expedition && !missionState
  const systems = currentView === 'Home' && !bridge && !insideEvening && homeArea === 'Engineering'
  const hangar = currentView === 'Home' && !bridge && !insideEvening && homeArea === 'Hangar'
  const cargoRoom = currentView === 'Home' && !bridge && !insideEvening && homeArea === 'Cargo'
  const cabins = loaded && save && (deck || homeArea === 'Quarters' || newRecruit !== undefined) ? homestretchCabins(loaded.book, save) : []
  const newChapter = newRecruit === undefined ? undefined : loaded?.book.recruits?.find(row => row.outfit === newRecruit)?.story[0]
  const startChapter = newChapter ? navigation?.quests.get(newChapter) : undefined
  const startTrip = startChapter && loaded && save && homeQuestTravel(save, loaded.book, startChapter)
  const quarters = currentView === 'Home' && !bridge && (homeArea === 'Quarters' || insideEvening)
  const showOperationsProgress = (bridge || currentView === 'Operations') && !missionState
  const managedQuests = new Set((loaded?.book.recruits ?? []).flatMap(({ outfit, signOn, story }) =>
    [signOn, ...story, ...rehabilitationQuestIds(catalog?.arcs.get(outfit))]))
  const readiness = loaded && save && !expedition && !missionState ? finaleReadiness(save, loaded.book) : undefined
  const finalActivities = loaded && save ? finaleActivities(save, loaded.book) : []
  const repairs = loaded && save ? finaleRepairOptions(save, loaded.book) : []
  const available = bridge && loaded && save && !night && !pendingPair && !missionState
    ? loaded.book.quests.filter(q => !managedQuests.has(q.id) && questAvailable(save, loaded.book, q, supply?.port)).slice(0, 3) : []
  const evening = loaded?.book.evening
  const canRest = !expedition && !!(day && !night && !pendingPair && !missionState && evening && complete.has(evening.after))
  function openNavigation(destination?: string) {
    setPortTarget(destination)
    selectView('Home', 'Navigation')
  }
  const supplyPanel = !expedition && loaded && save && supply && network && port && support && !night && !pendingPair && !missionState && !eveningOpen
    ? <SupplyPanel showMap={!cargoRoom} save={save} network={network} supply={supply} port={developedPort(loaded.book, save, port)} worlds={loaded.book.story.worlds}
      upkeep={campaignUpkeep(loaded.book, save, support.ashore)} book={loaded.book} assets={loaded.assets}
      open={id => { const quest = navigation?.quests.get(id); if (quest && questAvailable(save, loaded.book, quest, port.id)) openCampaignQuest(quest); else selectView('Operations') }}
      locate={() => setLocation(port.id)} destination={portTarget} watch={canRest ? () => {
        if (loaded.book.stationStory) void updateSave(s => s.mission || s.expedition || s.campaignDay.pending || s.pairScene
          || nightActive(s) ? s : advanceStationWatches(s, loaded.book, 1))
        else chooseEvening(null)
      } : undefined} /> : null
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
  const workshopPanel = !expedition && loaded && save && support && !night && !pendingPair && !missionState && !eveningOpen
    && workshopAt(save, loaded.book)
    ? <Suspense fallback={null}><WorkshopPanel save={save} loaded={loaded} ashore={support.ashore} /></Suspense> : null
  const visitOptions = canRest ? evening?.visits.filter((v) => !support?.ashore.has(v.companion) && save?.crew.some((crew) => crew.outfit === v.companion)) ?? [] : []
  const dateOptions = loaded && save && canRest ? dates.filter(date =>
    canBookNightContact(save, loaded.book, [campaignSpeaker(loaded.book.allies, date.companion)]))
    .sort((a, b) => contactDay(save, campaignSpeaker(loaded.book.allies, a.companion))
      - contactDay(save, campaignSpeaker(loaded.book.allies, b.companion))).map((date) => {
    const visit = dateProgress(save, loaded.book, date).visit
    const cabin = visit === date.regular ? loaded.book.cabinEvenings?.find(c => 'companion' in c.source && c.source.companion === date.companion) : undefined
    return { visit: { kind: 'visit' as const, companion: date.companion, scene: visit.scene, morning: visit.morning }, title: visit.title, cabin,
      established: !!save.crew.find(row => row.outfit === date.companion)?.bond.path }
  }) : []
  const sharedCabins = loaded && save && canRest ? loaded.book.cabinEvenings?.filter(c => !('companion' in c.source) && cabinAvailable(save, loaded.book, c) && canBookNightContact(save, loaded.book, cabinVisitors(loaded.book, c))) ?? [] : []
  const consentOffers = quarters && loaded && save && canRest ? loaded.book.allies?.flatMap(ally => {
    const quest = sharedConsentOffer(save, loaded.book, ally)
    return quest ? [{ ally, quest }] : []
  }) ?? [] : []
  function chooseCabin(cabin: CabinEvening) {
    if (!loaded || !day || !canRest) return
    setEveningOpen(false)
    commitScene(s => {
      const next = pinEvening(startCabinEvening(s, loaded.book, cabin, day.day))
      return next !== s && next.station && 'companion' in cabin.source
        ? { ...next, station: cancelStationAppointment(next.station, { actor: cabin.source.companion }) } : next
    })
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
      if (!visit && loaded.book.stationStory) return pinEvening(closeNight(s, loaded.book))
      let actors = visit ? visitActors(loaded.book, visit) : []
      if (visit?.kind === 'pair-visit') {
        const sector = loaded.book.sectors?.find((row) => sectorNightId(row) === visit.pair)
        if (sector) {
          const eligible = sectorVisit(loaded.book, s, sector)
          if (!eligible || eligible.scene !== visit.scene || eligible.morning !== visit.morning) return s
          actors = [sector.officer, sector.former!.speaker]
          if (!canBookNightContact(s, loaded.book, actors)) return s
          const entered = spendNightContact(s, loaded.book, actors)
          return settleDay(entered, startCampaignNight(entered.campaignDay, visit))
        }
        const pair = loaded?.book.pairs.find((pair) => pair.id === visit.pair)
        if (!pair || !loaded || !pairAvailable(s, loaded.book, pair)) return s
        const cabin = pairVisit(pair, s.story, s.crew.flatMap(({ outfit }) => ashore.has(outfit) ? [] : [outfit]))
        if (![cabin, availableSharedVisit(s, pair)].some((option) => option?.scene === visit.scene && option.morning === visit.morning)) return s
      }
      if (visit && !canBookNightContact(s, loaded.book, actors)) return s
      const entered = visit ? spendNightContact(s, loaded.book, actors) : s
      if (visit?.kind === 'visit') {
        const date = loaded.book.dates?.find(row => row.companion === visit.companion)
        if (date && !dateAvailable(entered, loaded.book, date)) return s
      }
      const campaignDay = startCampaignNight(entered.campaignDay, visit)
      if (campaignDay === entered.campaignDay) return s
      const next = settleDay(entered, campaignDay)
      return next.station && visit?.kind === 'visit'
        ? { ...next, station: cancelStationAppointment(next.station, { actor: visit.companion }) } : next
    })
  }
  function visitFromRoster(date: CampaignDate) {
    const option = dateOptions.find(({ visit }) => visit.companion === date.companion)
    if (!option) return
    const visit = () => { if (option.cabin) chooseCabin(option.cabin); else chooseEvening(option.visit) }
    if (loaded && save && date.companion === loaded.book.stationStory?.opening?.actor
      && supply?.port === stationOf(save, loaded.book).anchor && stationDate(stationOf(save, loaded.book).absoluteWatch).phase !== 'Duty'
      && showStationStory('free-watch', visit)) return
    visit()
  }
  function focusStationRoom(room: StationModule) {
    setStationFocus({ room, deck: STATION_MODULES[room].deck, zoom: 1 })
    selectView('Home')
  }
  function openCampaignQuest(quest: CampaignQuest) {
    const duo = loaded && expeditionForQuest(loaded.book, quest.id)
    if (duo?.expedition?.route?.launch === quest.id) setLaunchReview(quest)
    else if (loaded && isCareSession(loaded.book, quest.id)) openCare(quest)
    else setActive(quest)
  }
  function reviewExpeditionLaunch(id: string) {
    const quest = navigation?.quests.get(id)
    if (quest) openCampaignQuest(quest)
  }
  function openCare(quest: CampaignQuest, missed = false) {
    if (!loaded || !save) return
    if (careLeadAway(save, loaded.book, quest.id)) {
      selectView('Home', 'Quarters')
      return
    }
    const venue = carePort(loaded.book, save, quest.id) ?? (isCareSession(loaded.book, quest.id) ? stationOf(save, loaded.book).anchor : undefined)
    const arc = loaded.book.stationStory?.opening && catalog?.arcs.get(loaded.book.stationStory.opening.actor)
    const prelude = arc?.rehabilitation?.sessions.includes(quest.id) ? 'rehab-next' : undefined
    const open = () => {
      if (venue && venue !== port?.id) openNavigation(venue)
      else if (questAvailable(save, loaded.book, quest, port?.id)) {
        if (!prelude || !showStationStory(prelude, () => setActive(quest))) setActive(quest)
      } else selectView('Home', 'Quarters')
    }
    if (!missed || !prelude || !showStationStory('rehab-missed', open)) open()
  }
  function sharedFromRoster(actor: Speaker) {
    const ally = loaded?.book.allies?.find(row => row.heroine === actor || row.partner === actor)
    const cabin = ally && sharedCabins.find(row => 'trio' in row.source && row.source.trio === ally.heroine)
    return cabin ? () => chooseCabin(cabin) : undefined
  }
  const activePlan = loaded && save ? expeditionPlan(save, loaded.book, complete) : null
  const activeShip = expedition && !expedition.berthed ? catalog?.duos.get(expedition.duo)?.expedition?.route?.name ?? expedition.ship : 'Homestretch'
  const atStation = !!(save && loaded && supply?.port === stationOf(save, loaded.book).anchor)
  const stationStory = loaded?.book.stationStory
  function openExpeditionQuest(quest: CampaignQuest) {
    const open = () => openCampaignQuest(quest)
    if (expedition && expedition.ship === stationStory?.pilotShip && activePlan?.route.stops[0] === quest.id
      && showStationStory('errand-brief', open)) return
    open()
  }
  const homeSignals = deck && atStation && loaded && save && stationStory ? [
    ...(save.crew.some(member => member.outfit === stationStory.opening?.actor) ? ['first-home'] : []),
    ...(stationRoom(stationOf(save, loaded.book), 'habitat-a') === 'active'
      && !['room-ready','room-ready-fallback'].some(key => save.story.seen.includes(stationStory.transition.get(key) ?? ''))
      ? [save.station?.report?.workers.includes(stationStory.opening?.actor ?? -1) ? 'room-ready' : 'room-ready-fallback'] : []),
    ...(stationRoom(stationOf(save, loaded.book), 'shipyard') === 'active' ? ['yard-open'] : []),
    ...(finalBook && save.story.flags.includes(finalBook.returnToPlay) ? ['lark-home'] : []),
  ].flatMap(key => {
    const scene = stationStory.transition.get(key)
    return scene && !save.story.seen.includes(scene) ? [{ key, scene }] : []
  }) : []

  return (
    <main ref={screen} className={viewport} style={insets} data-campaign data-campaign-release={loaded?.release.release}>
      <div className="mx-auto max-w-5xl space-y-3">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#0b0d17]/95 pb-2">
          <nav aria-label="Campaign navigation" className="flex flex-wrap items-center gap-1">
            {(menuReady && !missionState && !insideEvening ? campaignViews : ['Home'] as const).map(item =>
              <button type="button" key={item} className={campaignControl + ' aria-[current=page]:border-cyan-200 aria-[current=page]:text-cyan-200'}
                aria-current={item === currentView ? 'page' : undefined} onClick={() => selectView(item)}>{item}</button>)}
          </nav>
          <Link to={campaignAccount} className={campaignControl}>Account</Link>
        </header>
        {menuReady && currentView === 'Home' && !deck && !insideEvening && !missionState && <nav aria-label="Ship areas" className="flex flex-wrap gap-2">
          {homeAreas.filter(area => !expedition || !['Quarters', 'Hangar', 'Cargo'].includes(area)).map(area => <button key={area} type="button" className={campaignControl + ' aria-pressed:border-cyan-200/80'}
            aria-pressed={area === homeArea} onClick={() => area === 'Navigation' ? openNavigation() : selectView('Home', area)}>{area}</button>)}
        </nav>}
        {deck && loaded && save && loaded.book.fourAct && <Suspense fallback={<p role="status">Opening Homestretch…</p>}>
          <StationHome book={loaded.book} save={save} focus={stationFocus} onFocus={setStationFocus} open={area => selectView('Home', area)}
            recruit={() => selectView('Recruit')} calendar={() => selectView('Calendar')}
            relocation={delayed => { showStationStory(delayed ? 'translation-delayed' : 'translation', undefined, delayed) }}
            returnHome={() => openNavigation(stationOf(save, loaded.book).anchor)} />
        </Suspense>}
        {homeSignals.length > 0 && <section className="flex flex-wrap gap-2" aria-label="Station reports">
          {homeSignals.map(({ key, scene }) => <button key={key} type="button" className={campaignControl}
            onClick={() => setStationScene({ scene })}>{key === 'first-home' ? 'Report to the berth' : key === 'yard-open' ? 'Inspect the new shipyard'
              : key === 'lark-home' ? 'Report to Homestretch' : 'Open Habitat A'}</button>)}
        </section>}
        {bridge && loaded && save && (!deck || !loaded.book.fourAct) && <ShipHome ship={activeShip}
          location={expedition?.berthed ? 'Expedition at launch berth' : expedition ? activePlan?.current?.title ?? 'Expedition underway' : port?.name} day={day?.day}
          cargo={(expedition && !expedition.berthed ? expedition : undefined) ?? (supply && { fuel: supply.fuel, provisions: supply.provisions, alloy: save.wallet.alloy })}
          backdrop={expedition && !expedition.berthed ? undefined : loaded.assets.get('homestretch-bridge')}
          ready={available} open={setActive}
          deck={deck ? { open: room => selectView('Home', room), crew: cabins.length, reactor: reactorPips(save.ship), hangar: moduleAt(save.ship, 'hangar')?.level ?? 0 } : undefined}
          recruit={menuReady && !expedition && !missionState && loaded.book.recruits?.length ? () => selectView('Recruit') : undefined}
          navigation={deck ? () => openNavigation() : undefined}
          roster={menuReady && !missionState ? () => selectView('Roster') : undefined}
          operations={menuReady && !missionState ? () => selectView('Operations') : undefined} />}
        {currentView === 'Recruit' && loaded && save && <Suspense fallback={<p role="status">Opening recruitment…</p>}>
          <RecruitCrew book={loaded.book} save={save} assets={loaded.assets}
            meet={startRecruitTrip} cargo={() => selectView('Home', 'Cargo')} />
        </Suspense>}
        {currentView === 'Calendar' && loaded && save && <Suspense fallback={<p role="status">Opening calendar…</p>}>
          <StationCalendar book={loaded.book} save={save} travel={openNavigation} room={focusStationRoom} quarters={() => selectView('Home', 'Quarters')}
            observance={(scene, flag) => setStationScene({ scene, flag })}
            openCare={(id, missed) => { const quest = navigation?.quests.get(id); if (quest) openCare(quest, missed) }} openVisit={actor => {
            const date = loaded.book.dates?.find(row => row.companion === actor)
            if (date && canRest && dateAvailable(save, loaded.book, date)) visitFromRoster(date)
            else selectView('Home', 'Quarters')
          }} />
        </Suspense>}
        {currentView === 'Roster' && newRecruit !== undefined && loaded && <section aria-label="Recruit aboard"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-200/30 bg-[#101e32] p-3">
          <div><h2 className="font-display text-xl font-bold">{nameOf(loaded.book.story, newRecruit)} is aboard</h2>
            <p className="text-sm text-cyan-200">Quarters · {cabins.find(cabin => cabin.outfit === newRecruit)?.temporary ? 'Guest room' : 'Cabin'} {cabins.find(cabin => cabin.outfit === newRecruit)?.berth ?? 'pending'}</p></div>
          {startChapter && startTrip && <button type="button" className={campaignPrimary + ' disabled:opacity-40'}
            disabled={!startTrip.affordable} onClick={() => void meetQuest(startChapter)}>Start Act I{startTrip.fuel ? ' · ' + startTrip.fuel + ' fuel' : ''}</button>}
        </section>}
        {currentView === 'Roster' && navigation && loaded && save && <Suspense fallback={<p role="status">Opening roster…</p>}>
          <RosterScreen book={loaded.book} save={save} assets={loaded.assets} complete={complete} navigation={navigation}
            port={port?.id} open={openCampaignQuest} travel={openNavigation} evening={canRest ? visitFromRoster : undefined}
            shared={sharedFromRoster} report={setReportScene}
            browse={rosterBrowse} onBrowse={setRosterBrowse} />
        </Suspense>}
        {currentView === 'Operations' && navigation && loaded && save && <Suspense fallback={<p role="status">Opening operations…</p>}>
          <OperationsScreen book={loaded.book} save={save} port={port?.id} complete={complete} navigation={navigation}
            open={openCampaignQuest} travel={openNavigation} browse={operationBrowse} onBrowse={setOperationBrowse}
            startSalvage={(contract, outfit) => {
              setGroundPaused(false)
              void updateSave(current => startSalvage(current, loaded.book, loaded.release.release, contract, outfit))
            }} />
          {loaded.book.stationStory && <details className="rounded-xl border border-white/15 p-2">
            <summary className="flex min-h-11 cursor-pointer items-center px-2 font-semibold">Fleet and shipyard</summary>
            <StationFleet book={loaded.book} save={save} complete={complete} navigation={openNavigation} reviewLaunch={reviewExpeditionLaunch} operations
              yardRoom={() => focusStationRoom('shipyard')} inspect={() => showStationStory('errand-commission')} />
          </details>}
        </Suspense>}
        <div className="space-y-3">
          {error && !pending && <button type="button" className={button} onClick={() => setCheck(n => n + 1)}>Try again</button>}
          {bridge && loaded && save && complete.has(loaded.book.opening) && loaded.book.tiers?.map((tier, index) => {
            const prior = loaded.book.tiers?.[index - 1]?.core
            if (index > 0 && (!prior || !complete.has(prior.settles))) return null
            const captures = campaignCaptures(tier, save)
            return <section key={tier.number} aria-label={`Tier ${tier.number} captures`} className="rounded-lg border border-white/15 p-2 text-sm">
              <p className="font-semibold">Tier {tier.number} · {captures}/{CORE_CAPTURES} captures</p>
              <p className="mt-1 text-white/75">{complete.has(tier.signal) ? 'Signal heard' : `Signal at ${SIGNAL_CAPTURES} captures`}</p>
              {tier.core && <p className="text-white/75">{complete.has(tier.core.settles) ? 'Core cleared' : `Core at ${CORE_CAPTURES} captures`}</p>}
            </section>
          })}
          {expedition && loaded && save && navigation && !missionState && currentView !== 'Roster' && <ExpeditionPanel
            book={loaded.book} save={save} port={port?.id} complete={complete} navigation={navigation} open={openExpeditionQuest}
            report={setReportScene} travel={openNavigation} systems={systems} parked={ship => {
              if (ship === stationStory?.pilotShip) showStationStory('errand-park', undefined, true)
            }} />}
          {currentView === 'Operations' && loaded && expeditions && expeditions.length > 0 && complete.has(loaded.book.opening) && <details
            className="space-y-2 rounded-lg border border-white/15 p-2 text-sm" aria-label="Expedition readiness">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold">Expedition readiness</summary>
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
          </details>}
          {pending && <p role="status">Checking the release…</p>}
          {error && <p role="alert" className="break-words text-[#ffa7b7]">{error}</p>}
          {(night || pendingPair) && !pending && !error && <p role="alert" className="text-[#ffa7b7]">This release is missing the saved scene.</p>}
          {supply && !port && <p role="alert" className="text-[#ffa7b7]">This release is missing the saved port.</p>}
          {missionState && (training || ground) && <button type="button" className={button} onClick={() => setGroundPaused(false)}>Resume {ground?.title ?? 'Training'}</button>}
          {missionState && optionalTraining && <button type="button" className={button} onClick={() => void updateSave((s) =>
            s.mission === missionState ? { ...s, mission: null } : s
          )}>Leave Training</button>}
          {missionState && loaded && !training && !ground && <p role="alert" className="text-[#ffa7b7]">This release is missing the saved encounter.</p>}
          {systems && loaded && save && !expedition && !eveningOpen && managementAt(save, loaded.book) && <section aria-label="Ship and port" className="space-y-2">
            <h2 className="font-display text-lg font-bold">Ship and port</h2>
            <div className="grid grid-cols-2 gap-2">
              {loaded.book.management?.locations.filter(room => locationAvailable(save, loaded.book, room)).map(room =>
                <button key={room.id} type="button" className={button} onClick={() => setLocation(room.id)}>
                  {room.title}<span className="ml-2 text-xs capitalize text-white/60">{locationState(save, loaded.book, room)}</span>
                </button>)}
            </div>
          </section>}
          {quarters && loaded && !showingEvening && <section aria-label="Crew cabins" className="space-y-2 rounded-xl border border-white/15 p-3">
            <h2 className="font-display text-lg font-bold">Quarters</h2>
            {cabins.length > 0 && save ? <Suspense fallback={<p role="status">Opening cabin directory…</p>}>
              <StationCabins cabins={cabins} book={loaded.book} save={save} open={actor => {
                const kind = navigation?.roster.find(row => row.speaker === actor)?.kind
                if (!kind) return
                setRosterBrowse({ kind, search: '', page: 0, selected: actor })
                selectView('Roster')
              }} />
            </Suspense> : <button type="button" className={campaignPrimary} onClick={() => selectView('Recruit')}>Recruit crew</button>}
          </section>}
          {quarters && loaded && day && consentOffers.length > 0 && <section aria-label="Shared evening invitations" className="flex flex-wrap gap-2">
            {consentOffers.map(({ ally, quest }) => <button key={quest.id} type="button" className={button}
              onClick={() => setSharedConsent({ ally, quest, day: day.day })}>
              Talk about a shared evening with {nameOf(loaded.book.story, ally.partner)} and {nameOf(loaded.book.story, ally.heroine)}
            </button>)}
          </section>}
          {quarters && canRest && !showingEvening && loaded && save && <button type="button" className={button} onClick={() => {
            void updateSave(current => current.mission || current.expedition || current.pairScene || current.campaignDay.pending
              ? current : enterNight(current, loaded.book)).then(() => setEveningOpen(true))
          }}>{loaded.book.stationStory ? (watchesUntilNight(save, loaded.book)
            ? 'Start night · ' + watchesUntilNight(save, loaded.book) + ' watches' : 'Open evening') : 'End day'}</button>}
          {quarters && canRest && showingEvening && loaded && save && <section aria-label="Evening" className="space-y-2 rounded-xl border border-white/15 p-3">
            {loaded.book.stationStory && <>
              <h2 className="font-display text-lg">2200 · Off duty</h2>
              <p className="text-sm">{nightVisitsLeft(save)} {nightVisitsLeft(save) === 1 ? 'visit' : 'visits'} left · Staying overnight ends the night</p>
              <nav aria-label="Evening crew" className="flex flex-wrap gap-2">
                {(['Uma', 'General', 'Lieutenant', 'Shared'] as const).map(role => <button key={role} type="button" className={button}
                  aria-pressed={eveningRole === role} onClick={() => setEveningRole(role)}>{role}</button>)}
              </nav>
              <input type="search" aria-label="Find someone to visit" placeholder="Find someone to visit" value={eveningSearch}
                onChange={event => setEveningSearch(event.currentTarget.value)} className="min-h-11 rounded bg-white/10 px-3 text-sm" />
            </>}
            <div className="flex flex-wrap gap-2">
            {visitOptions.map((visit) => <button key={visit.companion} type="button" className={button}
              onClick={() => chooseEvening({ kind: 'visit', ...visit })}>Visit {nameOf(loaded.book.story, visit.companion)}</button>)}
            {dateOptions.flatMap(({ visit, title, cabin, established }) => {
              const actor = campaignSpeaker(loaded.book.allies, visit.companion)
              const name = nameOf(loaded.book.story, actor)
              if (loaded.book.stationStory && ((typeof actor === 'number' ? 'Uma' : 'General') !== eveningRole
                || !name.toLocaleLowerCase().includes(eveningSearch.trim().toLocaleLowerCase()))) return []
              const last = contactDay(save, actor)
              return [<button key={visit.companion} type="button" className={button + ' flex-col items-start py-2'}
                onClick={() => cabin ? chooseCabin(cabin) : chooseEvening(visit)}>
                <span>{name} · {title}</span>
                {loaded.book.stationStory && <span className="text-xs text-cyan-200">
                  {last ? 'Last visit · ' + (save.campaignDay.day - last) + ' nights ago' : 'First visit'}{established && ' · Established bond'}
                </span>}
              </button>]
            })}
            {eveningRole === 'Lieutenant' && loaded.book.stationStory && (save.station?.lieutenantResidents ?? []).flatMap(actor => {
              const name = nameOf(loaded.book.story, actor)
              if (!atStation || voyageCrew(save).has(actor) || !canBookNightContact(save, loaded.book, [actor])
                || !name.toLocaleLowerCase().includes(eveningSearch.trim().toLocaleLowerCase())) return []
              const last = contactDay(save, actor)
              return [<button key={actor} type="button" className={button + ' flex-col items-start py-2'}
                onClick={() => void updateSave(current => checkInWithLieutenant(current, loaded.book, actor))}>
                <span>Check in with {name}</span>
                <span className="text-xs text-cyan-200">{last ? 'Last check-in · ' + (save.campaignDay.day - last) + ' nights ago' : 'First check-in'}</span>
              </button>]
            })}
            {(!loaded.book.stationStory || eveningRole === 'Shared') && sharedCabins.map(cabin => {
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
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={button} onClick={() => chooseEvening(null)}>{loaded.book.stationStory ? 'End night' : 'My quarters'}</button>
              {!insideEvening && <button type="button" className={button} onClick={() => setEveningOpen(false)}>Back</button>}
            </div>
          </section>}
        </div>
        <div className="space-y-3">
          {systems && save && <section aria-label="Engineering" className="rounded-xl border border-white/15 p-3">
            <h2 className="font-display text-lg font-bold">Engineering</h2>
            <p className="text-sm text-cyan-200">Reactor · {reactorPips(save.ship)} power</p>
          </section>}
          {systems && loaded && save && port && <SectorPanel book={loaded.book} save={save} />}
          {systems && loaded && save && port && !expedition
            ? <ProjectsPanel book={loaded.book} save={save} port={port} showReport={setReportScene} expanded /> : null}
          {showOperationsProgress && loaded && save && readiness && readiness.capitals > 0 && !night && !pendingPair && !eveningOpen &&
            <section aria-label="Act IV · The final operation" className="space-y-2 rounded-lg border border-white/15 p-3 text-sm">
              <h2 className="font-semibold">Act IV · The final operation</h2>
              <p>{readiness.capitals} / 5 capital settlements</p>
              <p>End one Seraine in each court to trace the way to its Queen.</p>
              <ul>{readiness.courts.map(court => <li key={court.name}>
                {court.name} · {court.witness ? 'Last pulse traced' : 'Last pulse needed'}
                {!court.witness && <ul>{court.witnesses.filter(witness => loaded.book.quests.some(q => q.id === witness.release))
                  .map(witness => <li key={witness.flag} className="ml-4 text-white/70">
                    {loaded.book.quests.find(q => q.id === witness.release)?.title}
                  </li>)}</ul>}
              </li>)}</ul>
              {readiness.ready && !save.finaleProgress?.witnesses && <>
                <p>Select the ten-person ground formation.</p>
                {finaleFormations(save, loaded.book).map(duo => <button key={duo.id} type="button" className={button}
                  aria-pressed={save.finaleProgress?.duo === duo.id}
                  onClick={() => commitScene(s => selectFinaleFormation(s, loaded.book, duo.id))}>
                  {duo.umas.map(actor => nameOf(loaded.book.story, actor)).join(' and ')}
                </button>)}
              </>}
              {finaleVoices(save, loaded.book).map(({ actor }) => <button key={actor} type="button" className={button}
                onClick={() => commitScene(s => selectFinaleVoice(s, loaded.book, actor))}>
                {actor === 'captain' ? 'Speak from the bridge' : 'Ask ' + nameOf(loaded.book.story, actor) + ' to speak'}
              </button>)}
            </section>}
          {showOperationsProgress && loaded && save && repairs.map(({ quest, active, label, reports }) => <section key={quest}
            aria-label="Civilian repair" className="space-y-2 rounded-lg border border-white/15 p-3 text-sm">
            <p>{label}</p>
            <p>{active?.progress ?? 0} / 2 work stages{active?.paused && ' · Paused'}</p>
            {active?.paused
              ? <button type="button" className={button} onClick={() => {
                void updateSave(s => workFinaleRepair(s, loaded.book, quest, 'resume')).then(() => {
                  if (!showStationStory('repair-resume', () => setReportScene(reports.retry), true)) setReportScene(reports.retry)
                })
              }}>Resume work</button>
              : <>
                {(active?.progress ?? 0) < 2 && <button type="button" className={button} disabled={!save.campaignSupply?.provisions}
                  onClick={() => commitScene(s => workFinaleRepair(s, loaded.book, quest, 'work'))}>Work · 1 provision</button>}
                {active && active.progress < 2 && <button type="button" className={button} onClick={() => {
                  void updateSave(s => workFinaleRepair(s, loaded.book, quest, 'pause')).then(() => setReportScene(reports.withdrawal))
                }}>Pause work</button>}
              </>}
          </section>)}
          {bridge && finalActivities.length > 0 && <section aria-label="Visits and homecoming" className="flex flex-wrap gap-2">
            {finalActivities.map(activity => <button key={activity.scene} type="button" className={button}
              onClick={() => setFinaleScene(activity.scene)}>{activity.title}</button>)}
          </section>}
          {bridge && loaded?.book.finale && save && supply && !night && !pendingPair && !missionState && !eveningOpen &&
            <FinalePanel book={loaded.book} story={save.story} complete={complete.has(loaded.book.finale.lastWatch ?? loaded.book.finale.ending)} />}
          {quarters && !eveningOpen && datePanel}
          {hangar && loaded && save && !expedition && <section aria-label="Hangar" className="space-y-3 rounded-xl border border-white/15 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">Hangar</h2>
              <button type="button" className={button} onClick={() => {
                setRosterBrowse(current => ({ ...current, tab: 'Equipment' }))
                selectView('Roster')
              }}>Crew rigs</button>
            </div>
            {save.crew.some(member => !member.expeditionOnly)
              ? <Suspense fallback={<p role="status">Opening squads…</p>}><Squads save={{ ...save, crew: save.crew.filter(member => !member.expeditionOnly) }}
                  nameOf={outfit => { const member = save.crew.find(row => row.outfit === outfit); return nameOf(loaded.book.story, member ? crewSpeaker(member) : outfit) }} /></Suspense>
              : <button type="button" className={campaignPrimary} onClick={() => selectView('Recruit')}>Recruit crew</button>}
          </section>}
          {hangar && workshopPanel}
          {hangar && loaded && save && loaded.book.fourAct && <Suspense fallback={<p role="status">Opening cutter berth…</p>}>
            <StationFleet book={loaded.book} save={save} complete={complete} navigation={openNavigation} reviewLaunch={reviewExpeditionLaunch}
              yardRoom={() => focusStationRoom('shipyard')} inspect={() => showStationStory('errand-commission')} />
          </Suspense>}
          {quarters && pairPanels}
          {quarters && loaded && save && !eveningOpen && <Suspense fallback={null}>
            <StationCare book={loaded.book} save={save} port={port?.id} open={openCare} travel={openNavigation} />
          </Suspense>}
          {systems && basePanels}
          {currentView === 'Home' && !bridge && (homeArea === 'Navigation' || cargoRoom) && supplyPanel}
          {currentView === 'Operations' && loaded && save && Object.keys(save.story.files).length > 0 && <section aria-label="Evidence" className="space-y-2 rounded-xl border border-white/15 p-3">
            <h2 className="font-display text-lg font-bold">Evidence</h2>
            {Object.entries(save.story.files).map(([id, indices]) => {
              const evidence = loaded.book.story.files[id]
              return evidence && <ul key={id} aria-label={id.replaceAll('-', ' ')} className="space-y-1 text-sm">
                {indices.map((index) => evidence.lines[index] && <li key={index}>{evidence.lines[index]!.text}</li>)}
              </ul>
            })}
          </section>}
        </div>
      </div>
    </main>
  )
}
