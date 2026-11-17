import {
  COMMAND_HULL, COMMAND_ORDERS, COMMAND_SHIELD, COMMAND_STATIONS, MAX_DRILLS, commandActionError, resumeCommand,
  type CampaignSupply, type CampaignReleaseFile, type CommandAction, type CommandEncounter, type CommandInput, type CommandState, type Mission, type Save,
} from '@cyber/domain'
import { useEffect, useState } from 'react'
import { finishMission, retry, toDeploy } from '../mission/director'
import { updateSave } from '../save/game'
import { assignOfficer, canLaunch, drillOfficer, issueCommand, launchCommand, settleCommand } from './command'
import { campaignImage } from './load'

const button = 'min-h-11 rounded-lg bg-white/10 px-3 text-sm font-semibold text-white disabled:opacity-50'
const primary = 'min-h-11 rounded-lg bg-[#2ee6ff] px-3 text-sm font-bold text-[#0b0d17] disabled:opacity-50'
const insets = { margin: 'var(--inset-top) var(--inset-right) var(--inset-bottom) var(--inset-left)' }
const stations = { pilot: 'Pilot', shields: 'Shields', gunnery: 'Gunnery', engineering: 'Engineering' }
const orders = { evade: 'Evade', brace: 'Brace shields', fire: 'Fire guns', intercept: 'Intercept', strike: 'Fighter strike', reroute: 'Reroute power' }
const powerLabels = { shields: 'Shields', guns: 'Guns', fighters: 'Fighters' }
const orderLine = (encounter: CommandEncounter, last: NonNullable<CommandState['last']>) =>
  last.emitterHit && encounter.assault ? encounter.assault.call : encounter.calls[last.order]

export default function ShipCommandScreen({ save, mission, encounter, supply, names, backdrop }: {
  save: Save; mission: Mission; encounter: CommandEncounter; supply: CampaignSupply; names: ReadonlyMap<number, string>; backdrop?: CampaignReleaseFile
}) {
  const [background, setBackground] = useState<string | null>(null)
  useEffect(() => {
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
  const run = state.battle ? resumeCommand(state.battle.input, state.battle.actions) : null
  const assault = run ? run.input.version === 2 : !!encounter.assault
  return <main className="absolute inset-0 overflow-y-auto bg-[#0b1020] bg-cover bg-center p-3 text-[#e8ebf5]"
    style={{ ...insets, ...(background ? { backgroundImage: `linear-gradient(#080d1aeb, #080d1acf), url(${background})` } : {}) }}>
    <div className="mx-auto max-w-4xl space-y-3">
      <h1 className="font-display text-xl font-bold">{assault
        ? state.step === 'results' ? state.won ? 'Approach secured' : 'Approach withdrawn' : 'Station approach'
        : state.step === 'results' ? state.won ? 'Convoy secured' : 'Defense lost' : 'Convoy defense'}</h1>
      {state.step === 'briefing' && <>
        <p className="max-w-xl text-sm">{mission.brief}</p>
        <button type="button" className={primary} onClick={() => void updateSave(toDeploy)}>Prepare ship</button>
      </>}
      {state.step === 'deploy' && <>
        <div className="grid gap-2 sm:grid-cols-2">
          {COMMAND_STATIONS.map((station) => {
            const officer = save.commandCrew[station]
            const assigned = officer && names.has(officer.outfit) ? officer : undefined
            const canDrill = assigned && assigned.drills < MAX_DRILLS && assigned.trainedDay !== save.campaignDay.day
            return <div key={station} className="rounded-lg border border-white/15 p-2">
              <label className="flex items-center justify-between gap-2 font-semibold">{stations[station]}
                <select className="min-h-11 rounded-lg bg-[#182238] px-2 text-sm" value={assigned?.outfit ?? ''}
                  onChange={(event) => { const value = event.currentTarget.value; void updateSave((s) => assignOfficer(s, station, value ? Number(value) : null)) }}>
                  <option value="">Watch officer</option>
                  {[...names].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
              {assigned && <button type="button" className={`${button} mt-2`} disabled={!canDrill} onClick={() => void updateSave((s) => drillOfficer(s, station))}>
                Drill {stations[station].toLowerCase()} · {assigned.drills}/{MAX_DRILLS}
              </button>}
            </div>
          })}
        </div>
        <p className="text-sm">Cargo {supply.fuel} fuel · {supply.provisions} provisions</p>
        <button type="button" className={primary} disabled={!canLaunch(supply, encounter)} onClick={() => void updateSave((s) => launchCommand(s, s.campaignSupply ?? supply, encounter))}>
          Launch · {encounter.cost.fuel} fuel · {encounter.cost.provisions} provisions
        </button>
      </>}
      {state.step === 'battle' && (run ? <CommandBoard encounter={encounter} {...run} />
        : <p role="alert">The saved defense can’t resume.</p>)}
      {state.step === 'results' && <div className="flex flex-wrap gap-2">
        {run?.state.last && <p className="w-full text-sm">{orderLine(encounter, run.state.last)}</p>}
        {run?.state.emitter === 0 && <p className="w-full text-sm text-cyan-200">Emitter disabled. Maintenance entrance open.</p>}
        {state.won ? <button type="button" className={primary} onClick={() => void updateSave((s) => settleCommand(s, encounter.id))}>Debrief</button>
          : <button type="button" className={primary} onClick={() => void updateSave(retry)}>{assault ? 'Retry approach' : 'Retry defense'}</button>}
      </div>}
      {(state.step !== 'battle' || !run) && !state.won && <button type="button" className={button} onClick={() => void updateSave(finishMission)}>Return to port</button>}
    </div>
  </main>
}

function CommandBoard({ encounter, input, state }: { encounter: CommandEncounter; input: CommandInput; state: CommandState }) {
  const [action, setAction] = useState<CommandAction>({ order: 'fire', shields: 1, guns: 1, fighters: 1 })
  const threat = input.threats[state.turn]!
  const spent = action.shields + action.guns + action.fighters
  const problem = commandActionError(state, action)
  return <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
    <section className="space-y-2 rounded-lg border border-white/15 bg-[#131c30] p-3" aria-label="Tactical display">
      <div className="flex flex-wrap justify-between gap-1 text-sm font-bold">
        <span>Wave {state.turn + 1}/{input.threats.length}</span><span>Reactor {spent}/{state.power}</span>
      </div>
      <p className="rounded-lg bg-[#58263d] px-2 py-1 text-sm font-semibold">Incoming {threat.section} · {threat.power} fire · {threat.fighters} fighters</p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
        {([
          ['Fore shield', state.shields.fore, COMMAND_SHIELD], ['Aft shield', state.shields.aft, COMMAND_SHIELD],
          ['Hull', state.hull, COMMAND_HULL], [input.version === 2 ? 'Boarding shuttle' : 'Transport', state.transport, input.transport],
          [input.version === 2 ? 'Patrol ship' : 'Raider', state.enemy, input.enemy],
          ...(input.version === 2 ? [['Shield emitter', state.emitter ?? 0, input.assault.emitter] as const] : []),
        ] as const).map(([label, value, max]) => <div key={label}><span>{label} {value}/{max}</span>
          <progress className="block h-1.5 w-full accent-cyan-300" aria-label={label} value={value} max={max} /></div>)}
      </div>
      {state.last && <div role="status" className="text-sm" key={state.turn}>
        <p>{orderLine(encounter, state.last)}</p>
        <p className="text-white/70">{state.last.blocked} blocked · {state.last.intercepted} intercepted · {state.last.emitterHit || state.last.hit} {state.last.emitterHit ? 'emitter' : 'enemy'} damage · {state.last.hullDamage + state.last.transportDamage} friendly damage</p>
      </div>}
    </section>
    <section className="space-y-2" aria-label="Commands">
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
          aria-pressed={action.target === 'emitter'} onClick={() => setAction((a) => ({ ...a, order: 'fire', target: 'emitter' }))}>Target emitter</button>}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className={primary} disabled={!!problem} onClick={() => {
          void updateSave((s) => issueCommand(s, encounter.id, state.turn, action))
          if (action.target) setAction((a) => ({ ...a, target: undefined }))
        }}>Execute order</button>
        {problem && <p className="text-sm">{problem}</p>}
      </div>
    </section>
  </div>
}
