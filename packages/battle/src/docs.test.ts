// The manual's tuning tables are the code's (CY4): docs/game/battle.md holds them between `<!-- live:tuning -->` and
// `<!-- /live -->`, rendered here from TUNING. `pnpm docs:update` rewrites the block; this test fails when it's stale.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TUNING as T } from './tuning'
import type { Band } from './types'

const DOC = join(__dirname, '../../../docs/game/battle.md')
const BANDS: Band[] = [1, 2, 3, 4, 5]

export function tuningTables(): string {
  const t = T.bandThresholds
  const stat = (b: Band) => (b === 5 ? `${t[4]}+` : b === 1 ? `under ${t[1]}` : `${t[b - 1]}–${t[b] - 1}`)
  const hp = (b: Band) => `${T.partHp.core.base + T.partHp.core.perBand * b} / ${T.partHp.leftArm.base + T.partHp.leftArm.perBand * b} / ${T.partHp.legs.base + T.partHp.legs.perBand * b}`
  const turn = (b: Band) => Math.ceil(T.clockFull / T.clockRate[b])
  const rows = [
    '| Band | Stat at 5★ | Speed: a turn every | Speed: Move | Speed: evasion | Stamina: Core / arm / Legs HP | Power: Capacity | Power: Melee bonus | Wit: accuracy |',
    '|---|---|---|---|---|---|---|---|---|',
    ...BANDS.map((b) => `| ${b} | ${stat(b)} | ${turn(b)} ticks | ${T.move[b]} | ${T.speedEvasion * b}% | ${hp(b)} | ${T.capacity.base + T.capacity.perBand * b} | +${T.meleePowerPerBand * b} | +${T.witAccuracy * b}% |`),
  ]
  const charge = T.charge
  const w = T.partWeights
  return [
    '**The bands** (Guts: Hold on at band ' + T.holdOnBand + ' or more):',
    '',
    ...rows,
    '',
    '**The rest of the table:**',
    '',
    '| Rule | Number |',
    '|---|---|',
    `| A round | ${T.roundTicks} ticks (a turn fills at ${T.clockFull}) |`,
    `| Wait | +${charge.wait} Charge, and her clock restarts at ${T.waitClock} instead of 0 |`,
    `| Charge | Starts at ${charge.start}, +${charge.perTurn} a turn, cap ${charge.cap}; a counter, a Crossfire and a Cover cost ${charge.counter} each |`,
    `| Light rig | +1 Move at ${T.lightRigPct}% of Capacity or less |`,
    `| Broken Legs | Move ${T.brokenLegsMove}, no level changes, evasion 0 |`,
    `| A step | Climbs or drops ${T.stepHeight} level at most |`,
    `| Hit % | Accuracy + Wit − evasion − ${T.aimPenalty} when aimed, clamped to ${T.hitClamp[0]}–${T.hitClamp[1]}%; a two-handed weapon with one arm broken fires at ${T.oneArmTwoHandedPct}% accuracy |`,
    `| Crit | ${T.baseCrit}% unless the weapon says, ×${T.critPct / 100} damage |`,
    `| Facing | Side ×${T.sidePct / 100}, back ×${T.backPct / 100} (past shield and counter) |`,
    `| Height | ±${T.heightPctPerLevel}% damage a level; Melee and Short reach ${T.reachLevels} levels up or down; Long +${T.longHeightBonus.range} range from ${T.longHeightBonus.levels} levels up |`,
    `| Coat | ×${T.coatPct / 100} against its damage type |`,
    `| Damage | At least ${T.minDamage} |`,
    `| Crossfire | ${T.crossfireMax} allies at most |`,
    `| Hold on | Survives at Core ${T.holdOnCore}, once a battle |`,
    `| Board | ${T.map.minSize}–${T.map.maxSize} tiles a side, heights 0–${T.map.maxHeight}, ${T.map.squad} squad spawns, ${T.map.maxEnemies} enemies at most |`,
    '',
    '**Where hits land** (out of 100):',
    '',
    '| Band | Core | Each arm | Legs |',
    '|---|---|---|---|',
    ...(['melee', 'short', 'long'] as const).map((b) => `| ${b[0]!.toUpperCase()}${b.slice(1)} | ${w[b].core} | ${w[b].leftArm} | ${w[b].legs} |`),
  ].join('\n')
}

describe('the manual', () => {
  it('holds the current tuning tables', () => {
    const doc = readFileSync(DOC, 'utf8')
    const block = `<!-- live:tuning -->\n${tuningTables()}\n<!-- /live -->`
    const current = doc.replace(/<!-- live:tuning -->[\s\S]*?<!-- \/live -->/, block)
    if (process.env.UPDATE_DOCS === '1') writeFileSync(DOC, current)
    else expect(doc, 'docs/game/battle.md is stale: run pnpm docs:update').toBe(current)
  })
})
