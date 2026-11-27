import {
  CAMPAIGN_ACT_XP, COMMAND_HULL, COMMAND_ORDERS, COMMAND_SHIELD, COMMAND_STATIONS, MAX_DRILLS, STARTER_CUTTER, commandActionError, commandFacts, resolvedCommand, resumeCommand,
  type CampaignSupply, type CampaignReleaseFile, type CommandAction, type CommandEncounter, type CommandInput, type CommandState, type CommandStation, type Mission, type Save,
} from '@cyber/domain'
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { finishMission, toDeploy } from '../mission/director'
import { updateSave } from '../save/game'
import { assignOfficer, canLaunch, drillOfficer, issueCommand, launchCommand, missionOfficer, settleCommand } from './command'
import { missionAshore } from './call-up'
import { campaignImage, type LoadedCampaign } from './load'
import { CampaignScene } from './CampaignScene'
import { CommandCinematic } from './CommandCinematic'
import { acknowledgeEnemySignal, commandContextScene, freezeCommandCast, pendingEnemySignal, replayCommandCinema, retryCommand, savedCommandEvent } from './cinematics'
import { finaleBridgeAllies, finaleRun, retryCampaignAttempt, withdrawCampaignAttempt } from './cy90'
import { nameOf } from '../story/runner'
import { expeditionOfficer, expeditionStations, setExpeditionOfficer } from './expedition'
import { campaignCommandFront, tuneCampaignCommand } from './command-tuning'
import { forecastStation } from './station-forecast'
import { CampaignThumbnail } from './CampaignThumbnail'
import type { CombatReadiness } from './navigation'
import { BattleHelp } from '../battle/BattleHelp'
import { orderTopics } from '../battle/help'
import { CutterVisual } from './VesselVisuals'

const button = 'min-h-11 rounded-lg bg-white/10 px-3 text-sm font-semibold text-white disabled:opacity-50'
const primary = 'min-h-11 rounded-lg bg-[#2ee6ff] px-3 text-sm font-bold text-[#0b0d17] disabled:opacity-50'
const insets = { margin: 'var(--inset-top) var(--inset-right) var(--inset-bottom) var(--inset-left)' }
const stations = { pilot: 'Pilot', shields: 'Shields', gunnery: 'Gunnery', engineering: 'Engineering' }
const orders = { evade: 'Evade', brace: 'Brace shields', fire: 'Fire guns', intercept: 'Intercept', strike: 'Fighter strike', reroute: 'Reroute power' }
const powerLabels = { shields: 'Shields', guns: 'Guns', fighters: 'Fighters' }

export default function ShipCommandScreen({ save, mission, encounter, supply, names, backdrop, objectiveArt, objectiveLabel, ashore, homeDefense, finale, emitterRoute, qualifications, portraits, requiredLead, loaded, readiness }: {
  loaded: LoadedCampaign
  save: Save; mission: Mission; encounter: CommandEncounter; supply: CampaignSupply; names: ReadonlyMap<number, string>; backdrop?: CampaignReleaseFile
  objectiveArt?: CampaignReleaseFile; objectiveLabel?: string
  ashore: ReadonlySet<number>; homeDefense?: { name: string; relay: number }
  finale?: { allies: number; preparation: { alloy: number; integrity: number }; contributions?: string[] }
  requiredLead?: number
  qualifications?: ReadonlyMap<number, CommandStation>
  portraits?: ReadonlyMap<number | string, CampaignReleaseFile>
  emitterRoute?: string
  readiness?: CombatReadiness
}) {
  const [background, setBackground] = useState<string | null>(null)
  const [reinforce, setReinforce] = useState(false)
  const [action, setAction] = useState<CommandAction>({ order: 'fire', shields: 1, guns: 1, fighters: 1 })
  const [context, setContext] = useState<string | null>(null)
  const reports = loaded.book.fourActFinale?.reports.get(mission.id)
  const withdrawn = save.finaleProgress?.withdrawn === mission.id
  const [showRetry, setShowRetry] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signalError, setSignalError] = useState<string | null>(null)
  useEffect(() => {
    setBackground(null)
    if (!backdrop) return
    let live = true
    let image: string | undefined
    void campaignImage(backdrop).then((url) => {
      if (!live) { URL.revokeObjectURL(url); return }
      image = url
      setBackground(url)
    }, () => { if (live) setBackground(null) })
    return () => { live = false; if (image) URL.revokeObjectURL(image) }
  }, [backdrop])
  const state = save.mission
  if (!state) return null
  const expedition = save.expedition
  const finaleBridge = readiness?.act === 4
  const clearedAllies = (current: Save) => finaleBridge ? finaleBridgeAllies(current, loaded.book) : undefined
  const currentAllies = clearedAllies(save)
  const fourAct = loaded.book.fourAct
  const prepared = fourAct ? tuneCampaignCommand(encounter, campaignCommandFront(loaded.book, save, encounter.id)) : encounter
  const cargo = expedition ? { ...supply, fuel: expedition.fuel, provisions: expedition.provisions } : supply
  const station = loaded.book.stationStory
  const rationShort = state.step === 'deploy' && station && !expedition && canLaunch(cargo, prepared)
    ? [...forecastStation({ ...save, mission: null, campaignSupply: { ...cargo, provisions: cargo.provisions - prepared.cost.provisions } },
      loaded.book, station.commandWatches?.get(encounter.id) ?? 1).dawns.values()].find(row => row.cutterShort)?.cutterShort
    : undefined
  const run = state.battle ? resumeCommand(state.battle.input, state.battle.actions) : null
  const assigned = expedition ?? (finale ? finaleRun(save, loaded.book) : undefined)
  const namedCutter = assigned && loaded.book.fourAct?.duos.get(assigned.duo)?.expedition?.route?.name
  const vessel = run?.input.vessel ?? (fourAct ? {
    id: assigned?.ship ?? STARTER_CUTTER.id,
    name: namedCutter ?? assigned?.ship ?? STARTER_CUTTER.name,
    integrity: Math.max(1, assigned ? assigned.integrity ?? save.fleet?.[assigned.duo]?.integrity ?? save.fleet?.[assigned.duo]?.run?.integrity
      ?? COMMAND_HULL : save.station?.integrity ?? COMMAND_HULL),
  } : undefined)
  const assault = run ? run.input.version !== 1 : !!encounter.assault
  const preparation = reinforce ? finale?.preparation : undefined
  const contextButtons = (['alarm', 'preparation', 'victory', 'withdrawal', 'retry', 'disabled'] as const).flatMap(kind => {
    if (reports && (kind === 'withdrawal' || kind === 'retry')) return []
    const scene = commandContextScene(save, loaded.book, kind)
    return scene ? [<button key={kind} type="button" className={button} onClick={() => setContext(scene)}>{kind === 'alarm' ? 'Initial alarm' : kind === 'preparation' ? 'Mission context' : kind === 'retry' ? 'Retry briefing' : kind === 'disabled' ? 'Emitter report' : 'Crew report'}</button>] : []
  })
  const signal = pendingEnemySignal(save, loaded.book)
  if (signal && signalError) return <main className="absolute inset-0 bg-[#0b1020] p-4 text-white" style={insets}>
    <p role="alert">{signalError}</p>
    <button type="button" className={button} onClick={() => setSignalError(null)}>Retry enemy channel</button>
  </main>
  if (signal) return <CampaignScene key={loaded.release.release + ':' + signal.scene} loaded={loaded} sceneId={signal.scene} squad={state.squad}
    finish={() => void updateSave(s => acknowledgeEnemySignal(s, loaded.book, encounter.id, signal)).catch(() => setSignalError('Could not save the enemy transmission.'))}
    fail={setSignalError} />
  if (context && loaded.book.scenes.has(context)) return <CampaignScene key={loaded.release.release + ':' + context} loaded={loaded} sceneId={context} squad={state.squad}
    finish={() => setContext(null)} fail={message => { setError(message); setContext(null) }} onExit={() => setContext(null)} exitLabel="Back to bridge" />
  return <main className="absolute inset-0 overflow-y-auto bg-[#0b1020] bg-cover bg-center p-3 text-[#e8ebf5]"
    style={{ ...insets, ...(background ? { backgroundImage: `linear-gradient(#080d1aeb, #080d1acf), url(${background})` } : {}) }}>
    <div className="mx-auto max-w-4xl space-y-3">
      {vessel && <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-cyan-200">{vessel.name} · {expedition ? '10 aboard' : 'Cutter command'}</p>
        <CutterVisual id={vessel.id} name={vessel.name} integrity={run?.state.hull ?? vessel.integrity}
          reinforced={assigned?.reinforced ?? (assigned && save.fleet?.[assigned.duo]?.reinforced)}
          state={run ? 'underway' : 'berthed'} compact />
      </div>}
      {error && <p role="alert">{error}</p>}
      <h1 className="font-display text-xl font-bold">{assault
        ? state.step === 'results' ? state.won ? 'Approach secured' : 'Approach withdrawn' : finale ? 'Gate approach' : 'Station approach'
        : homeDefense ? state.step === 'results' ? state.won ? 'Relay secured' : 'Defense lost' : `Defend ${homeDefense.name}`
          : state.step === 'results' ? state.won ? 'Convoy secured' : 'Defense lost' : 'Convoy defense'}</h1>
      {state.step === 'briefing' && <>
        <p className="max-w-xl text-sm">{mission.brief}</p>
        <div className="flex items-center gap-2"><button type="button" className={primary} onClick={() => void updateSave(toDeploy)}>Prepare ship</button><BattleHelp /></div>
      </>}
      {state.step === 'deploy' && <>
        <div className="flex items-center text-sm">Bridge stations <BattleHelp topic="bridge" /></div>
        {expedition && <div className="grid gap-2 sm:grid-cols-2" aria-label="Expedition bridge stations">
          {COMMAND_STATIONS.map(station => <label key={station} className="flex items-center justify-between gap-2 font-semibold">{stations[station]}
            <select className="min-h-11 rounded-lg bg-[#182238] px-2 text-sm" value={expeditionStations(expedition)[station]}
              onChange={event => { const member = Number(event.currentTarget.value); void updateSave(s => setExpeditionOfficer(s, station, member)) }}>
              {expedition.members.map((member, i) => <option key={i} value={i}>{nameOf(loaded.book.story, member.role === 'uma' ? member.outfit : member.heroine)}</option>)}
            </select><span className="text-sm">Drill {expeditionOfficer(expedition, station).drills}</span>
          </label>)}
          {expedition.reinforced && <p className="text-sm text-cyan-200">Escort refit · +1 integrity</p>}
        </div>}
        {!expedition && <div className="grid gap-2 sm:grid-cols-2">
          {COMMAND_STATIONS.map((station) => {
            const officer = missionOfficer(save, station)
            const assigned = officer && names.has(officer.outfit) ? officer : undefined
            const canDrill = assigned && !currentAllies?.has(assigned.outfit) && assigned.drills < MAX_DRILLS && assigned.trainedDay !== save.campaignDay.day
            return <div key={station} className="rounded-lg border border-white/15 p-2">
              <label className="flex items-center justify-between gap-2 font-semibold">{stations[station]}
                <select className="min-h-11 rounded-lg bg-[#182238] px-2 text-sm" value={assigned?.outfit ?? ''}
                  onChange={(event) => { const value = event.currentTarget.value; void updateSave((s) => assignOfficer(s, station, value ? Number(value) : null, missionAshore(loaded.book, s), clearedAllies(s))) }}>
                  <option value="">Watch officer</option>
                  {[...names].map(([id, name]) => <option key={id} value={id}>{name}{qualifications?.get(id) === station ? ' · Qualified' : ''}</option>)}
                </select>
              </label>
              {assigned && !state.callUp && <button type="button" className={`${button} mt-2`} disabled={!canDrill} onClick={() => void updateSave((s) => drillOfficer(s, station, ashore))}>
                Drill {stations[station].toLowerCase()} · {assigned.drills}/{MAX_DRILLS}
              </button>}
            </div>
          })}
        </div>}
        {readiness && <div className="flex items-center text-sm">Recommended Lv {readiness.minimum}–{readiness.maximum}
          {!!readiness.bridge && ` · Bridge drills ${readiness.bridge}+`}<BattleHelp topic="readiness" /></div>}
        <div className="flex items-center text-sm">Cargo {cargo.fuel} fuel · {cargo.provisions} provisions <BattleHelp topic="supplies" /></div>
        {!!rationShort && <p className="text-sm text-amber-200">After launch · Cutter short {rationShort} provisions at dawn</p>}
        <details className="text-sm"><summary className="min-h-11 cursor-pointer py-2">Threat forecast · {prepared.threats.length} waves</summary>
          <ol className="list-decimal space-y-1 pl-5">{prepared.threats.map((wave, i) => <li key={i}>{wave.section === 'fore' ? 'Fore' : 'Aft'} · {wave.power} incoming power · {wave.fighters} fighters</li>)}</ol>
        </details>
        {!!homeDefense?.relay && <p className="text-sm text-cyan-200">Local shield bank · +{homeDefense.relay} relay integrity</p>}
        {!!finale?.allies && <p className="text-sm text-cyan-200">Homeworld escort · +{finale.allies} shuttle integrity</p>}
        {!!finale?.contributions?.length && <details className="text-sm"><summary className="min-h-11 cursor-pointer py-2">Fleet contributions · {finale.contributions.length}</summary>
          <ul className="space-y-1">{finale.contributions.map((entry) => <li key={entry}>{entry}</li>)}</ul>
        </details>}
        {finale && <button type="button" className={button} aria-pressed={reinforce}
          disabled={!reinforce && save.wallet.alloy < finale.preparation.alloy} onClick={() => setReinforce(!reinforce)}>
          Reinforce shuttle · {finale.preparation.alloy} alloy · +{finale.preparation.integrity} integrity
        </button>}
        <button type="button" className={primary} disabled={!canLaunch(cargo, encounter) || save.wallet.alloy < (preparation?.alloy ?? 0)
          || (requiredLead !== undefined && (!names.has(requiredLead) || state.squad[0] !== requiredLead))}
          onClick={() => void updateSave(s => {
            const allies = clearedAllies(s)
            const voyage = s.expedition
            const objective = objectiveLabel ?? (encounter.assault ? 'Boarding shuttle' : homeDefense ? 'Relay integrity' : 'Transport')
            const cast = voyage ? (() => {
              const present = voyage.members.map(member => {
                const speaker = member.role === 'uma' ? member.outfit : member.heroine
                return { speaker, name: nameOf(loaded.book.story, speaker) }
              })
              const crew = Object.fromEntries(COMMAND_STATIONS.map(station => [station, present[expeditionStations(voyage)[station]]]))
              return { present, crew, objective: objectiveLabel ?? 'Expedition escort' }
            })() : freezeCommandCast(s, loaded.book, encounter.id, objective, allies)
            return launchCommand(s, s.campaignSupply ?? supply, prepared, {
              ashore: missionAshore(loaded.book, s), relay: homeDefense?.relay ?? finale?.allies ?? 0, preparation,
              qualifications, requiredLead, vessel, clearedAllies: allies, contributions: finale?.contributions, cast,
            })
          })}>
          Launch · {encounter.cost.fuel} fuel · {encounter.cost.provisions} provisions
        </button>
      </>}
      {(state.step === 'battle' || state.step === 'results') && (run ? <CommandBoard encounter={encounter} relay={!!homeDefense} {...run}
        actions={state.battle!.actions as CommandAction[]} portraits={portraits} loaded={loaded} cinema={save.commandCinema} action={action} setAction={setAction}
        objectiveArt={objectiveArt} objectiveLabel={objectiveLabel} allowAllySplash={!!expedition || finaleBridge} />
        : <p role="alert">The saved defense can’t resume.</p>)}
      {state.step === 'results' && !save.commandCinema.pending && <div className="flex flex-wrap gap-2">
        {state.won && readiness && !save.worlds.missions.includes(mission.id) && <p className="w-full text-sm">{CAMPAIGN_ACT_XP[readiness.act]} XP per eligible participant</p>}
        <BattleHelp topic="results" />
        {run?.state.last && <p className="w-full text-sm">{commandFacts(savedCommandEvent(save, run.state.turn)!)}</p>}
        {run?.state.emitter === 0 && <p className="w-full text-sm text-cyan-200">Emitter disabled{state.won && emitterRoute && ` · ${emitterRoute}`}</p>}
        {state.won ? <button type="button" className={primary} onClick={() => void updateSave((s) => settleCommand(s, encounter.id, loaded.book.fourAct ? { requiredLead, book: loaded.book, act: readiness?.act } : undefined))}>Debrief</button>
          : <button type="button" className={primary} onClick={() => {
            if (reports) { setShowRetry(true); setContext(reports.retry) }
            else void updateSave(retryCommand)
          }}>{assault ? 'Retry approach' : 'Retry defense'}</button>}
        {!state.won && reports && <button type="button" className={button}
          onClick={() => setContext(withdrawn ? reports.withdrawal : reports.failure)}>Crew report</button>}
        {showRetry && !context && <button type="button" className={primary}
          onClick={() => { setShowRetry(false); void updateSave(retryCampaignAttempt) }}>Resume with the same crew</button>}
      </div>}
      {reports && state.step === 'battle' && !save.commandCinema.pending && <button type="button" className={button}
        onClick={() => void updateSave(s => withdrawCampaignAttempt(s, encounter.id))}>Withdraw</button>}
      <div className="flex flex-wrap gap-2">{contextButtons}</div>
      {!expedition && (state.step !== 'battle' || !run) && !state.won && !save.commandCinema.pending && <button type="button" className={button} onClick={() => void updateSave(finishMission)}>Return to port</button>}
    </div>
  </main>
}

function CommandBoard({ encounter, input, state, relay, actions, portraits, objectiveArt, objectiveLabel, loaded, cinema, action, setAction, allowAllySplash }: {
  encounter: CommandEncounter; input: CommandInput; state: CommandState; relay: boolean; actions: readonly CommandAction[];
  loaded: LoadedCampaign; cinema: Save['commandCinema']; action: CommandAction; setAction: Dispatch<SetStateAction<CommandAction>>; portraits?: ReadonlyMap<number | string, CampaignReleaseFile>
  objectiveArt?: CampaignReleaseFile; objectiveLabel?: string; allowAllySplash: boolean
}) {
  const [pending, setPending] = useState(false)
  const threat = state.result ? undefined : input.threats[state.turn]
  const spent = action.shields + action.guns + action.fighters
  const problem = commandActionError(state, action, input)
  const event = state.last ? resolvedCommand(input, actions, state.turn) : null
  const officer = event?.actor
  const objective = input.presentation?.objective ?? objectiveLabel ?? (input.version !== 1 ? 'Boarding shuttle' : relay ? 'Relay integrity' : 'Transport')
  const log = actions.flatMap((_, index) => {
    const event = resolvedCommand(input, actions, index + 1)
    return event ? [`${event.actor?.name ?? 'Watch officer'} · ${orders[event.action.order]} · ${commandFacts(event)}`] : []
  })
  return <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
    <section className="space-y-2 rounded-lg border border-white/15 bg-[#131c30] p-3" aria-label="Tactical display">
      <div className="flex flex-wrap justify-between gap-1 text-sm font-bold">
        <span>{state.result ? `Resolved · ${state.turn} orders` : `Wave ${state.turn + 1}/${input.threats.length}`}</span><span>{state.result ? `Reactor ${state.power}` : `Reactor ${spent}/${state.power}`}</span>
      </div>
      <div className="flex items-center rounded-lg bg-[#58263d] px-2 text-sm font-semibold">{threat ? `Incoming ${threat.section} · ${threat.power} fire · ${threat.fighters} fighters` : 'Encounter resolved'} <BattleHelp topic="shipThreat" disabled={!!cinema.pending} /></div>
      <div className="flex gap-1"><BattleHelp topic="shipHull" disabled={!!cinema.pending} />
        {!!state.emitter && <BattleHelp topic="emitter" disabled={!!cinema.pending} />}</div>
      {objectiveArt && <div className="flex min-h-14 items-center gap-3 rounded-lg bg-[#24314a] px-2" data-command-objective>
        <CampaignThumbnail asset={objectiveArt} className="h-14 w-24 shrink-0 object-contain" />
        <div className="min-w-0 flex-1 text-sm">
          <div className="flex flex-wrap justify-between gap-x-2 font-semibold"><span>{objective}</span><span>{state.transport}/{input.transport}</span></div>
          <progress className="block h-1.5 w-full accent-cyan-300" aria-label={objective} value={state.transport} max={input.transport} />
        </div>
      </div>}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
        {([
          ['Fore shield', state.shields.fore, COMMAND_SHIELD], ['Aft shield', state.shields.aft, COMMAND_SHIELD],
          ['Hull', state.hull, COMMAND_HULL],
          ...(objectiveArt ? [] : [[objective, state.transport, input.transport] as const]),
          [input.version !== 1 ? 'Patrol ship' : 'Raider', state.enemy, input.enemy],
          ...(input.version !== 1 ? [['Shield emitter', state.emitter ?? 0, input.assault.emitter] as const] : []),
        ] as const).map(([label, value, max]) => <div key={label}><span>{label} {value}/{max}</span>
          <progress className="block h-1.5 w-full accent-cyan-300" aria-label={label} value={value} max={max} /></div>)}
      </div>
      {state.last && <div role="status" className="text-sm" key={state.turn}>
        <CampaignThumbnail asset={officer ? portraits?.get(officer.speaker) : undefined}
          className="float-right h-16 w-14 rounded-md object-cover object-top" />
        <p className="text-xs font-semibold text-cyan-200">{officer?.name ?? 'Watch officer'}</p>
        <p>{orders[state.last.order]}{event?.disabled ? ' · Emitter disabled' : state.last.emitterHit ? ' · Emitter hit' : ''}</p>
        <p className="text-white/70">{state.last.blocked} blocked · {state.last.intercepted} intercepted · {state.last.emitterHit || state.last.hit} {state.last.emitterHit ? 'emitter' : 'enemy'} damage · {state.last.hullDamage + state.last.transportDamage} friendly damage</p>
      </div>}
      {log.length > 0 && <details className="text-sm"><summary className="min-h-11 cursor-pointer py-2">Order log · {log.length}</summary>
        <ol className="list-decimal space-y-1 pl-5">{log.map((entry, index) => <li key={index}>{entry}</li>)}</ol>
      </details>}
      {input.version === 3 && input.contributions.length > 0 && <details className="text-sm"><summary className="min-h-11 cursor-pointer py-2">Fleet on station</summary>
        <ul className="space-y-1">{input.contributions.map((entry) => <li key={entry}>{entry}</li>)}</ul>
      </details>}
    </section>
    <section className="space-y-2" aria-label="Commands">
      {cinema.pending && event ? <CommandCinematic event={event} encounter={encounter.id} loaded={loaded} beat={cinema.pending.beat} fast={cinema.fast} allowAllySplash={allowAllySplash} /> : state.result ? <button type="button" className={button} onClick={() => void updateSave(replayCommandCinema)}>Replay last order</button> : <>
      <div className="flex items-center text-sm">Power allocation <BattleHelp topic="shipPower" detail={`${spent} of ${state.power} assigned`} /></div>
      <div className="grid grid-cols-3 gap-2">
        {(['shields', 'guns', 'fighters'] as const).map((system) => <div key={system} className="space-y-1 text-sm">
          <p>{powerLabels[system]} {action[system]}</p>
          <div className="flex gap-1">
            <button type="button" className={`${button} min-w-11`} aria-label={`Less ${powerLabels[system].toLowerCase()}`} disabled={action[system] === 0}
              onClick={() => setAction((a) => ({ ...a, [system]: a[system] - 1 }))}>−</button>
            <button type="button" className={`${button} min-w-11`} aria-label={`More ${powerLabels[system].toLowerCase()}`} disabled={spent >= state.power}
              onClick={() => setAction((a) => ({ ...a, [system]: a[system] + 1 }))}>+</button>
          </div>
        </div>)}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {COMMAND_ORDERS.map((order) => <button key={order} type="button" className={`${button} aria-pressed:ring-2 aria-pressed:ring-cyan-300`}
          aria-pressed={action.order === order && !action.target} onClick={() => setAction((a) => ({ ...a, order, target: undefined }))}>{orders[order]}</button>)}
        {!!state.emitter && <button type="button" className={`${button} aria-pressed:ring-2 aria-pressed:ring-cyan-300`}
          aria-pressed={action.target === 'emitter'} onClick={() => setAction((a) => ({ ...a, order: input.version === 3 ? 'strike' : 'fire', target: 'emitter' }))}>
          {input.version === 3 ? 'Fighters · emitter' : 'Target emitter'}
        </button>}
      </div>
      <div className="flex items-center gap-2">
        <BattleHelp topic={action.target === 'emitter' ? 'emitter' : orderTopics[action.order]} />
        <button type="button" className={primary} disabled={!!problem || pending} onClick={() => {
          setPending(true)
          void updateSave((s) => issueCommand(s, encounter.id, state.turn, action)).finally(() => setPending(false))
          if (action.target) setAction((a) => ({ ...a, target: undefined }))
        }}>Execute order</button>

        {problem && <p className="text-sm">{problem}</p>}
      </div>
      </>}
      {!cinema.pending && <button type="button" className={button} aria-pressed={cinema.fast} onClick={() => void updateSave(s => ({ ...s, commandCinema: { ...s.commandCinema, fast: !s.commandCinema.fast, pending: !s.commandCinema.fast && s.commandCinema.pending ? { ...s.commandCinema.pending, beat: 3 } : s.commandCinema.pending } }))}>Fast orders</button>}
    </section>
  </div>
}
