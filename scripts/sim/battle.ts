// The battle simulator (CY6, BP5): plays each scenario AI against AI over many seeds and writes a report, markdown and
// JSON, to sim/out/ (ignored by git). A battle past 60 rounds is a stalemate. Synthetic stand-ins only.
//
//   pnpm sim all --seeds 500
//   pnpm sim mirror --seeds 200 --compare sim/out/report.json
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chooseAction, chooseTurn } from '../../packages/battle/src/ai'
import { applyBattleAction, startBattle } from '../../packages/battle/src/battle'
import { scenarioInput, type Scenario } from '../../packages/battle/src/scenario'
import { loadScenarios } from '../../packages/battle/src/scenarios'
import { TUNING } from '../../packages/battle/src/tuning'
import type { BattleInput, BattleState, Cue, DamageType, Mount, Weapon } from '../../packages/battle/src/types'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = join(ROOT, 'sim/out')
const STALEMATE_ROUNDS = 60
const SECONDS_A_TURN = 40

export interface ScenarioReport {
  id: string
  title: string
  even: boolean
  battles: number
  wins: { squad: number; enemy: number }
  stalemates: number
  playerTurns: number
  rounds: number
  minutes: number
  damageByBand: Record<string, number>
  damageByType: Record<string, number>
  partsBroken: Record<string, number>
  rigBreaks: number
  rigBreaksAfterPart: number
  oneShots: number
  firstRoundBreaks: number
  counters: number
  crossfires: number
  covers: number
  chargeSpent: number
  chargeLeft: number
  heroines: { freed: number; broken: number; standing: number }
}

function weaponOf(input: BattleInput, unit: string, mount: Mount): Weapon | null {
  const l = input.units.find((u) => u.id === unit)?.loadout
  if (!l) return null
  const item = mount === 'back' ? l.back.weapon : mount === 'left' ? l.leftHand : l.rightHand
  return item?.kind === 'weapon' ? item : null
}

/** The squad profiles (CY17): bare, as Phases 2 and 3 played; and life aboard, rules version 3 with bond ranks 3, 7 and 10,
 * the first two as level-2 partners, three powered systems, two Orders the allies' Auto may take, and a meal. CY18 adds
 * cohesion: life aboard with the whole squad at cohesion level 5. */
export type Profile = 'bare' | 'life' | 'cohesion'
export function withProfile(input: BattleInput, profile: Profile): BattleInput {
  if (profile === 'bare') return input
  const squad = input.units.filter((u) => u.side === 'squad').map((u) => u.id)
  if (profile === 'cohesion') return { ...withProfile(input, 'life'), cohesion: { level: 5, leader: squad[0]!, members: squad } }
  const ranks = [3, 7, 10]
  return {
    ...input, rulesVersion: 3, meal: 'curry', systems: ['sensors', 'shield', { id: 'battery', level: 1, band: 3 }], orders: { slots: 2, kinds: ['sure', 'reboot'] },
    units: input.units.map((u) => {
      const i = squad.indexOf(u.id)
      if (i < 0) return u
      return { ...u, ...(ranks[i] ? { bond: { rank: ranks[i]!, path: 'trust' as const } } : {}), ...(i <= 1 && squad.length > 1 ? { partner: { unit: squad[1 - i]!, level: 2 as const } } : {}) }
    }),
  }
}

function play(input: BattleInput): { state: BattleState; cues: Cue[] } {
  const start = startBattle(input)
  let state = start.state
  const cues: Cue[] = [...start.cues]
  while (!state.result && state.time < STALEMATE_ROUNDS * TUNING.roundTicks) {
    const r = applyBattleAction(state, input.rulesVersion >= 3 ? chooseAction(state) : chooseTurn(state))
    if (r.error) throw new Error(`${input.seed}: ${r.error}`)
    cues.push(...r.cues)
    state = r.state
  }
  return { state, cues }
}

export function simulate(s: Scenario, map: Parameters<typeof scenarioInput>[1], seeds: number, profile: Profile = 'bare'): ScenarioReport {
  const r: ScenarioReport = {
    id: s.id, title: s.title, even: !!s.even, battles: seeds, wins: { squad: 0, enemy: 0 }, stalemates: 0, playerTurns: 0, rounds: 0, minutes: 0,
    damageByBand: {}, damageByType: {}, partsBroken: {}, rigBreaks: 0, rigBreaksAfterPart: 0, oneShots: 0, firstRoundBreaks: 0,
    counters: 0, crossfires: 0, covers: 0, chargeSpent: 0, chargeLeft: 0, heroines: { freed: 0, broken: 0, standing: 0 },
  }
  for (let seed = 1; seed <= seeds; seed++) {
    const input = withProfile(scenarioInput(s, map, seed), profile)
    const { state, cues } = play(input)
    if (state.result) r.wins[state.result.winner]++
    else r.stalemates++
    r.rounds += Math.ceil(state.time / TUNING.roundTicks)
    const brokeFirst = new Set<string>()
    const maxCore = new Map(state.units.map((u) => [u.id, u.maxHp.core]))
    const core = new Map(state.units.map((u) => [u.id, u.maxHp.core]))
    let current: { type: DamageType | null; band: string } = { type: null, band: '' }
    let round = 1
    for (const c of cues) {
      if (c.kind === 'turnStarted') {
        round = c.round
        if (state.units.find((u) => u.id === c.unit)?.side === 'squad') r.playerTurns++
      } else if (c.kind === 'attack') {
        const w = weaponOf(input, c.unit, c.with)
        current = { type: w?.type ?? null, band: c.band }
      } else if (c.kind === 'hit') {
        r.damageByBand[current.band] = (r.damageByBand[current.band] ?? 0) + c.amount
        if (current.type) r.damageByType[current.type] = (r.damageByType[current.type] ?? 0) + c.amount
        if (c.part === 'core') {
          if (c.broke && core.get(c.target) === maxCore.get(c.target)) r.oneShots++
          core.set(c.target, Math.max(0, (core.get(c.target) ?? 0) - c.amount))
        }
      } else if (c.kind === 'partBroke') {
        r.partsBroken[c.part] = (r.partsBroken[c.part] ?? 0) + 1
        if (c.part !== 'core') brokeFirst.add(c.unit)
      } else if (c.kind === 'rigBreak') {
        r.rigBreaks++
        if (brokeFirst.has(c.unit)) r.rigBreaksAfterPart++
        if (round === 1) r.firstRoundBreaks++
      } else if (c.kind === 'counter') r.counters++
      else if (c.kind === 'crossfire') r.crossfires++
      else if (c.kind === 'cover') r.covers++
      else if (c.kind === 'charge' && c.to < c.from) r.chargeSpent += c.from - c.to
    }
    r.chargeLeft += state.units.filter((u) => u.status === 'active').reduce((sum, u) => sum + u.charge, 0)
    for (const e of state.result?.enemies ?? []) {
      if (input.units.find((u) => u.id === e.id)?.hold !== undefined) r.heroines[e.fate]++
    }
  }
  r.minutes = (r.playerTurns / seeds) * SECONDS_A_TURN / 60
  return r
}

export interface Target { name: string; value: string; met: boolean }

/** The build plan's targets (BP5), each marked met or missed. */
export function targets(r: ScenarioReport): Target[] {
  const n = r.battles
  const total = Object.values(r.damageByBand).reduce((a, b) => a + b, 0) || 1
  const topBand = Object.entries(r.damageByBand).sort((a, b) => b[1] - a[1])[0]
  const mixed = Object.keys(r.damageByBand).length > 1
  const winRate = (r.wins.squad / n) * 100
  const out: Target[] = []
  if (r.even) out.push({ name: 'Even win rate 45–55%', value: `${winRate.toFixed(1)}%`, met: winRate >= 45 && winRate <= 55 })
  const turns = r.playerTurns / n
  out.push({ name: '8–14 player turns', value: turns.toFixed(1), met: turns >= 8 && turns <= 14 })
  out.push({ name: 'No full-HP Core broken in one hit', value: String(r.oneShots), met: r.oneShots === 0 })
  if (mixed && topBand) out.push({ name: 'No weapon band above 40% of damage', value: `${topBand[0]} ${((topBand[1] / total) * 100).toFixed(0)}%`, met: topBand[1] / total <= 0.4 })
  out.push({ name: 'A counter a battle', value: (r.counters / n).toFixed(1), met: r.counters / n >= 1 })
  out.push({ name: 'A Crossfire a battle', value: (r.crossfires / n).toFixed(1), met: r.crossfires / n >= 1 })
  out.push({ name: 'A Cover a battle', value: (r.covers / n).toFixed(1), met: r.covers / n >= 1 })
  out.push({ name: 'Over half the Rig Breaks after a part', value: r.rigBreaks ? `${((r.rigBreaksAfterPart / r.rigBreaks) * 100).toFixed(0)}%` : '—', met: r.rigBreaks === 0 || r.rigBreaksAfterPart / r.rigBreaks > 0.5 })
  const left = r.chargeLeft / n
  out.push({ name: 'Little Charge left (≤ 4 a battle)', value: left.toFixed(1), met: left <= 4 })
  out.push({ name: 'No stalemates', value: String(r.stalemates), met: r.stalemates === 0 })
  return out
}

function markdown(reports: ScenarioReport[], seeds: number, before?: ScenarioReport[]): string {
  const lines = [`# Battle simulator report`, '', `${seeds} seeds a scenario, AI against AI, rules version 2. Minutes at ${SECONDS_A_TURN} s a player turn.`, '']
  for (const r of reports) {
    const n = r.battles
    const old = before?.find((b) => b.id === r.id)
    lines.push(`## ${r.title} (\`${r.id}\`)`, '')
    lines.push('| Measure | Value |' + (old ? ' Before |' : ''), '|---|---|' + (old ? '---|' : ''))
    const row = (k: string, v: string, o?: string) => lines.push(`| ${k} | ${v} |` + (old ? ` ${o ?? ''} |` : ''))
    row('Squad wins', `${((r.wins.squad / n) * 100).toFixed(1)}%`, old && `${((old.wins.squad / old.battles) * 100).toFixed(1)}%`)
    row('Player turns', (r.playerTurns / n).toFixed(1), old && (old.playerTurns / old.battles).toFixed(1))
    row('Rounds', (r.rounds / n).toFixed(1), old && (old.rounds / old.battles).toFixed(1))
    row('Minutes', r.minutes.toFixed(1), old?.minutes.toFixed(1))
    const total = Object.values(r.damageByBand).reduce((a, b) => a + b, 0) || 1
    row('Damage by band', Object.entries(r.damageByBand).map(([k, v]) => `${k} ${((v / total) * 100).toFixed(0)}%`).join(', '))
    const tt = Object.values(r.damageByType).reduce((a, b) => a + b, 0) || 1
    row('Damage by type', Object.entries(r.damageByType).map(([k, v]) => `${k} ${((v / tt) * 100).toFixed(0)}%`).join(', '))
    row('Parts broken a battle', Object.entries(r.partsBroken).map(([k, v]) => `${k} ${(v / n).toFixed(1)}`).join(', '))
    row('Rig Breaks a battle', (r.rigBreaks / n).toFixed(1), old && (old.rigBreaks / old.battles).toFixed(1))
    row('Counters, Crossfires, Covers a battle', `${(r.counters / n).toFixed(1)}, ${(r.crossfires / n).toFixed(1)}, ${(r.covers / n).toFixed(1)}`, old && `${(old.counters / old.battles).toFixed(1)}, ${(old.crossfires / old.battles).toFixed(1)}, ${(old.covers / old.battles).toFixed(1)}`)
    row('Charge spent, left a battle', `${(r.chargeSpent / n).toFixed(1)}, ${(r.chargeLeft / n).toFixed(1)}`)
    row('First-round Rig Breaks', String(r.firstRoundBreaks))
    if (r.heroines.freed + r.heroines.broken + r.heroines.standing > 0) row('Heroines freed, broken, standing', `${r.heroines.freed}, ${r.heroines.broken}, ${r.heroines.standing}`)
    lines.push('', '| Target | Value | |', '|---|---|---|')
    for (const t of targets(r)) lines.push(`| ${t.name} | ${t.value} | ${t.met ? 'met' : '**missed**'} |`)
    lines.push('')
  }
  return lines.join('\n')
}

function main(): void {
  const args = process.argv.slice(2)
  const which = args.find((a) => !a.startsWith('--')) ?? 'all'
  if (which === 'balance') return balance(Number(args[args.indexOf('--seeds') + 1] ?? 200) || 200)
  const at = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined }
  const seeds = Number(at('--seeds') ?? 200)
  const compare = at('--compare')
  const { maps, scenarios } = loadScenarios(ROOT)
  const chosen = which === 'all' ? scenarios : scenarios.filter((s) => s.id === which)
  if (chosen.length === 0) throw new Error(`no scenario ${which}`)
  const before = compare ? (JSON.parse(readFileSync(compare, 'utf8')) as { reports: ScenarioReport[] }).reports : undefined
  const t0 = Date.now()
  const reports = chosen.map((s) => {
    const r = simulate(s, maps[s.map]!, seeds)
    console.log(`${s.id}: ${((r.wins.squad / seeds) * 100).toFixed(1)}% squad, ${(r.playerTurns / seeds).toFixed(1)} player turns, ${r.stalemates} stalemates`)
    return r
  })
  mkdirSync(OUT, { recursive: true })
  const name = which === 'all' ? 'report' : `report-${which}`
  writeFileSync(join(OUT, `${name}.json`), `${JSON.stringify({ seeds, reports }, null, 1)}\n`)
  writeFileSync(join(OUT, `${name}.md`), markdown(reports, seeds, before))
  const missed = reports.flatMap((r) => targets(r).filter((t) => !t.met).map((t) => `${r.id}: ${t.name} (${t.value})`))
  console.log(`\n${reports.length} scenarios × ${seeds} seeds in ${((Date.now() - t0) / 1000).toFixed(1)} s → sim/out/${name}.md`)
  console.log(missed.length ? `Missed:\n  ${missed.join('\n  ')}` : 'Every target met.')
}

/** The balance pass (CY17): every scenario with a bare squad and a life-aboard one. The targets (CY17's packet): a bare
 * squad wins as before (it plays rules version 2, frozen); a fully bonded squad wins about one battle in five more often
 * on average (a mean gain of 10 to 30 points), more often in every scenario, and never every battle. */
export function balance(seeds: number): void {
  const { maps, scenarios } = loadScenarios(ROOT)
  const rows = scenarios.map((s) => {
    const bare = simulate(s, maps[s.map]!, seeds, 'bare'), life = simulate(s, maps[s.map]!, seeds, 'life'), coh = simulate(s, maps[s.map]!, seeds, 'cohesion')
    const b = (bare.wins.squad / seeds) * 100, l = (life.wins.squad / seeds) * 100, c = (coh.wins.squad / seeds) * 100
    const met = l >= b && l < 100 && c < 100
    console.log(`${s.id}: bare ${b.toFixed(1)}%, life aboard ${l.toFixed(1)}% (${l - b >= 0 ? '+' : ''}${(l - b).toFixed(1)}), cohesion 5 ${c.toFixed(1)}% (${c - l >= 0 ? '+' : ''}${(c - l).toFixed(1)})${met ? '' : '  ← off target'}`)
    return { id: s.id, bare: b, life: l, gain: l - b, cohesion: c, cohesionGain: c - l, met }
  })
  const mean = rows.reduce((n, r) => n + r.gain, 0) / rows.length
  const cohMean = rows.reduce((n, r) => n + r.cohesionGain, 0) / rows.length
  mkdirSync(OUT, { recursive: true })
  const md = ['# Balance pass: bare and life aboard', '', `${seeds} seeds a scenario. Life aboard: rules version 3, bond ranks 3, 7, 10, the first two as level-2 partners, the Sensors, the Shield Projector and the Battery powered, Sure shot and Reboot for the allies' Auto, a curry.`, '',
    '| Scenario | Bare | Life aboard | Gain | Cohesion 5 | Its gain | On target |', '|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.id} | ${r.bare.toFixed(1)}% | ${r.life.toFixed(1)}% | ${r.gain >= 0 ? '+' : ''}${r.gain.toFixed(1)} | ${r.cohesion.toFixed(1)}% | ${r.cohesionGain >= 0 ? '+' : ''}${r.cohesionGain.toFixed(1)} | ${r.met ? 'yes' : 'no'} |`), '',
    `Mean gain: ${mean >= 0 ? '+' : ''}${mean.toFixed(1)} points (target: about one battle in five, 10 to 30 points; every scenario gaining, none at 100%).`,
    `Cohesion 5 over life aboard: ${cohMean >= 0 ? '+' : ''}${cohMean.toFixed(1)} points (target CY18: small, −2 to +8; none at 100%).`].join('\n')
  writeFileSync(join(OUT, 'balance.md'), `${md}\n`)
  writeFileSync(join(OUT, 'balance.json'), `${JSON.stringify({ seeds, rows, mean, cohesionMean: cohMean }, null, 1)}\n`)
  const meanMet = mean >= 10 && mean <= 30, cohMet = cohMean >= -2 && cohMean <= 8
  console.log(`\nMean gain ${mean.toFixed(1)} points${meanMet ? ' (on target: about one battle in five)' : ' ← off target'} → sim/out/balance.md`)
  console.log(`Cohesion 5 adds ${cohMean.toFixed(1)} points${cohMet ? ' (on target: small)' : ' ← off target'}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
