// The sandbox at /sandbox (CY8, TC54): set up any skirmish from a scenario, play it with the full battle screen on the
// phone, and read the results. The setup reads and writes CY6's scenario format; scenarios load from scenarios/ in git
// and from this phone's list; Copy and Paste move one as JSON. The battle autosaves to a local row after every action and
// when the page hides, and Resume replays it. `?debug` adds `window.__sandbox` (state, act, step, auto).
import { parseScenario, scenarioInput, type BattleMap, type Loadout, type Scenario } from '@cyber/battle'
import { TurnedStage, type StageLayout } from '@luismlorenzana/uma-stage'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { BattleView, type Control } from '../battle/BattleView'
import { resume, startSession, type Session } from '../battle/session'
import { clearBattle, readBattle, saveScenario, savedScenarios, writeBattle, type SandboxRow } from './store'

const MAPS: Record<string, BattleMap> = Object.fromEntries(Object.entries(import.meta.glob<{ default: BattleMap }>('../../../../scenarios/maps/*.json', { eager: true }))
  .map(([path, m]) => [path.split('/').pop()!.replace('.json', ''), m.default]))
const SCENARIOS: Scenario[] = Object.values(import.meta.glob<{ default: unknown }>('../../../../scenarios/*.json', { eager: true }))
  .map((m) => parseScenario(m.default, MAPS)).sort((a, b) => (a.id === 'sandbox-muster' ? -1 : b.id === 'sandbox-muster' ? 1 : a.id.localeCompare(b.id)))

/** The stand-in rigs a squad slot can take: every distinct squad loadout in git's scenarios, by role label. */
const RIGS: { name: string; loadout: Loadout }[] = (() => {
  const out = new Map<string, Loadout>()
  for (const s of SCENARIOS) for (const u of s.input.units) if (u.side === 'squad' && u.label) {
    const role = u.label.split(' ')[0]!
    if (!out.has(role)) out.set(role, u.loadout)
  }
  return [...out.entries()].map(([name, loadout]) => ({ name, loadout }))
})()

type Screen =
  | { kind: 'setup' }
  | { kind: 'battle'; session: Session; scenario: Scenario; control: Control; startedAt: string }
  | { kind: 'results'; session: Session; scenario: Scenario; control: Control; minutes: number }

export default function SandboxScreen() {
  return <TurnedStage>{(layout) => <Sandbox layout={layout} />}</TurnedStage>
}

function Sandbox({ layout }: { layout: StageLayout }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const debug = params.has('debug')
  const [screen, setScreen] = useState<Screen>({ kind: 'setup' })
  const [stored, setStored] = useState<SandboxRow | null>(null)
  const [local, setLocal] = useState<Scenario[]>([])
  const [scenario, setScenario] = useState<Scenario>(SCENARIOS[0]!)
  const [seed, setSeed] = useState<number>(SCENARIOS[0]!.seeds?.[0] ?? 1)
  const [control, setControl] = useState<Control>({ squad: 'player', enemy: 'ai' })
  const [note, setNote] = useState<string | null>(null)
  const latest = useRef<SandboxRow | null>(null)

  useEffect(() => {
    void readBattle().then(setStored)
    void savedScenarios().then((s) => setLocal(s.map((x) => x.scenario)))
  }, [])
  // The autosave also runs when the page hides (iOS may close the app any time after).
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden' && latest.current) void writeBattle(latest.current) }
    document.addEventListener('visibilitychange', flush)
    return () => document.removeEventListener('visibilitychange', flush)
  }, [])

  const choose = (s: Scenario) => { setScenario(s); setSeed(s.seeds?.[0] ?? 1); setControl(s.control ?? { squad: 'player', enemy: 'ai' }) }

  const begin = (s: Scenario, seedValue: number, ctrl: Control) => {
    const map = MAPS[s.map]
    if (!map) { setNote(`No map ${s.map}`); return }
    const input = scenarioInput(s, map, seedValue)
    const startedAt = new Date().toISOString()
    const session = startSession(input).session
    latest.current = { id: 'current', scenario: s, input, actions: [], rulesVersion: input.rulesVersion, updatedAt: startedAt, startedAt }
    void writeBattle(latest.current)
    setScreen({ kind: 'battle', session, scenario: s, control: ctrl, startedAt })
  }

  const resumeStored = (row: SandboxRow) => {
    const s = resume(row.input, row.actions)
    if ('error' in s) { setNote(`This battle no longer replays (${s.error}). Restart it from its scenario.`); return }
    latest.current = row
    setScreen({ kind: 'battle', session: s, scenario: row.scenario, control: row.scenario.control ?? { squad: 'player', enemy: 'ai' }, startedAt: row.startedAt })
  }

  const copy = async () => {
    const edited: Scenario = { ...scenario, seeds: [seed], control }
    try { await navigator.clipboard.writeText(JSON.stringify(edited, null, 1)); setNote('Copied') } catch { setNote('The clipboard is closed to this page') }
  }
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const s = parseScenario(JSON.parse(text), MAPS)
      choose(s)
      setNote(`Pasted ${s.id}`)
    } catch (e) { setNote(`Couldn't paste: ${e instanceof Error ? e.message : String(e)}`) }
  }
  const save = async () => {
    const edited: Scenario = { ...scenario, seeds: [seed], control }
    await saveScenario(edited)
    setLocal((await savedScenarios()).map((x) => x.scenario))
    setNote(`Saved ${edited.id} on this phone`)
  }
  const setRig = (unitId: string, rigName: string) => {
    const rig = RIGS.find((r) => r.name === rigName)
    if (!rig) return
    setScenario((s) => ({ ...s, input: { ...s.input, units: s.input.units.map((u) => (u.id === unitId ? { ...u, loadout: rig.loadout, label: `${rigName} ${u.label?.split(' ').pop() ?? ''}`.trim() } : u)) } }))
  }

  if (screen.kind === 'battle') {
    return (
      <BattleView key={screen.startedAt} layout={layout} session={screen.session} control={screen.control} debug={debug}
        onCommit={(s) => {
          const row: SandboxRow = { id: 'current', scenario: screen.scenario, input: s.input, actions: s.actions, rulesVersion: s.input.rulesVersion, updatedAt: new Date().toISOString(), startedAt: screen.startedAt }
          latest.current = row
          void writeBattle(row)
        }}
        onEnd={(s) => {
          const minutes = (Date.now() - Date.parse(screen.startedAt)) / 60_000
          void clearBattle()
          latest.current = null
          setStored(null)
          setScreen({ kind: 'results', session: s, scenario: screen.scenario, control: screen.control, minutes })
        }}
        onQuit={() => { setScreen({ kind: 'setup' }); void readBattle().then(setStored) }} />
    )
  }

  const panel = 'rounded-xl border border-white/10 bg-[#141827] p-3 text-[13px] text-[#e8ebf5]'
  const field = 'min-h-11 rounded-md bg-[#0b0d17] px-2 text-[#e8ebf5] ring-1 ring-white/15'
  const button = (label: string, onClick: () => void, primary = false) => (
    <button type="button" onClick={onClick} className={`min-h-11 rounded-md px-4 font-display font-bold ${primary ? 'bg-[#2ee6ff] text-[#0b0d17]' : 'bg-white/10 text-[#e8ebf5]'}`}>{label}</button>
  )

  if (screen.kind === 'results') {
    const { session, minutes } = screen
    const r = session.state.result
    const t = session.tally
    return (
      <div className="absolute inset-0 overflow-y-auto bg-[#0b0d17] p-4" style={{ paddingTop: 'calc(var(--inset-top) + 12px)', paddingLeft: 'calc(var(--inset-left) + 12px)' }}>
        <div data-results className={`${panel} mx-auto max-w-md space-y-2`}>
          <h1 className="font-display text-2xl font-bold" style={{ color: r?.winner === 'squad' ? '#2ee6ff' : '#ff3d6e' }}>{r?.winner === 'squad' ? 'Won' : 'Lost'}</h1>
          <div>Player turns: <b>{t.playerTurns}</b> · Minutes: <b>{minutes.toFixed(1)}</b></div>
          <div>Parts broken: <b>{t.partsBroken}</b> · Counters: <b>{t.counters}</b> · Crossfires: <b>{t.crossfires}</b> · Covers: <b>{t.covers}</b></div>
          {r?.enemies && <div className="text-[#a3abc2]">{r.enemies.filter((e) => e.fate !== 'standing').length} of {r.enemies.length} enemies beaten ({r.enemies.filter((e) => e.fate === 'freed').length} freed)</div>}
          <div className="flex flex-wrap gap-2 pt-2">
            {button('Retry', () => begin(screen.scenario, Number(session.input.seed.split(':').pop()), screen.control), true)}
            {button('New seed', () => begin(screen.scenario, Math.floor(Math.random() * 100_000), screen.control))}
            {button('Back to setup', () => setScreen({ kind: 'setup' }))}
          </div>
        </div>
      </div>
    )
  }

  const squadSlots = scenario.input.units.filter((u) => u.side === 'squad')
  const enemies = scenario.input.units.filter((u) => u.side === 'enemy')
  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#0b0d17] p-4" style={{ paddingTop: 'calc(var(--inset-top) + 12px)', paddingLeft: 'calc(var(--inset-left) + 12px)', paddingRight: 'calc(var(--inset-right) + 12px)' }}>
      <div className="mx-auto grid max-w-4xl gap-3 md:grid-cols-2">
        <div className={`${panel} space-y-2`}>
          <div className="flex items-center justify-between">
            <h1 className="font-display text-xl font-bold">Sandbox</h1>
            {button('Home', () => void navigate('/'))}
          </div>
          {stored && (
            <div data-resume className="rounded-md bg-[#2ee6ff]/10 p-2">
              <div>A battle in progress: <b>{stored.scenario.title}</b>, {stored.actions.length} actions in.</div>
              <div className="mt-2 flex gap-2">{button('Resume', () => resumeStored(stored), true)}{button('Restart', () => begin(stored.scenario, Number(stored.input.seed.split(':').pop()), stored.scenario.control ?? control))}</div>
            </div>
          )}
          <label className="block">Scenario
            <select className={`${field} mt-1 w-full`} value={scenario.id} onChange={(e) => { const s = [...SCENARIOS, ...local].find((x) => x.id === e.target.value); if (s) choose(s) }}>
              {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              {local.map((s) => <option key={`local-${s.id}`} value={s.id}>{s.title} (this phone)</option>)}
            </select>
          </label>
          <div className="text-[#a3abc2]">Map {scenario.map} · objective {scenario.input.objective.kind}{scenario.input.factions?.length ? ` · ${scenario.input.factions.join(', ')}` : ''}</div>
          <div className="flex items-end gap-2">
            <label className="block flex-1">Seed<input className={`${field} mt-1 w-full`} inputMode="numeric" value={seed} onChange={(e) => setSeed(Number(e.target.value.replace(/\D/g, '')) || 0)} /></label>
            {button('Roll', () => setSeed(Math.floor(Math.random() * 100_000)))}
          </div>
          <div className="flex gap-2">
            {(['squad', 'enemy'] as const).map((side) => (
              <label key={side} className="block flex-1 capitalize">{side}
                <select className={`${field} mt-1 w-full`} value={control[side]} onChange={(e) => setControl({ ...control, [side]: e.target.value as 'player' | 'ai' })}>
                  <option value="player">Player</option><option value="ai">AI</option>
                </select>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">{button('Start', () => begin(scenario, seed, control), true)}{button('Copy', () => void copy())}{button('Paste', () => void paste())}{button('Save', () => void save())}</div>
          {note && <div className="text-[#ffb84d]">{note}</div>}
        </div>
        <div className={`${panel} space-y-2`}>
          <h2 className="font-display font-bold">Squad</h2>
          {squadSlots.map((u) => (
            <label key={u.id} className="flex items-center justify-between gap-2">
              <span>{u.label ?? u.id}</span>
              <select className={field} value={u.label?.split(' ')[0] ?? ''} onChange={(e) => setRig(u.id, e.target.value)}>
                {RIGS.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
              </select>
            </label>
          ))}
          <h2 className="pt-2 font-display font-bold">Enemies</h2>
          <div className="text-[#a3abc2]">{enemies.map((u) => u.label ?? u.id).join(', ')}</div>
        </div>
      </div>
    </div>
  )
}
