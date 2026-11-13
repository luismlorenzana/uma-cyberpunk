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

/** Rules version 2's numbers (CY5). */
export function tuningTables2(): string {
  const t = T.terrain, k = T.tech, b = T.back, sk = T.skills, it = T.items, st = T.stride, be = T.bench, m = T.muster
  return [
    '| Rule | Number |',
    '|---|---|',
    `| Fire | ${t.fireDamage} F damage to the Legs on ending a turn there; burns out after ${t.fireRounds} rounds |`,
    `| Live | ${t.liveDamage} damage to the Core on entering or ending a turn there, past any Coat |`,
    `| Smoke | Blocks sight; −${t.smokePenalty}% to ranged hits into or out of it; clears after ${t.smokeRounds} rounds |`,
    `| Cover tile | −${t.coverEvasion}% to Short and Long hits from the front and sides |`,
    `| Lights out | −${t.lightsPenalty}% to ranged hits; turrets idle; ${t.lightsRounds} rounds |`,
    `| Tech | Range ${k.range[0]}–${k.range[1]} (Jack-Out ${k.jackOutRange}); ${k.base}% + ${k.perWit}% a Wit band − ${k.perGuts}% a Guts band, clamped ${k.clamp[0]}–${k.clamp[1]}% |`,
    `| Tech Charge | Stun ${k.stun}, Jam ${k.jam}, Jack-Out ${k.jackOut} (below ${k.jackOutCorePct}% Core); a landed Stun or Jam does ${k.holdDamage} to a Hold |`,
    `| Hacking | Range ${k.hackRange[0]}–${k.hackRange[1]}, ${k.hack} Charge, no roll |`,
    `| Impact Stun | ${T.impactStun}% on an impact hit to the Core |`,
    `| A Hold | ${T.holdHp} HP unless the unit says |`,
    `| Bulwark | Barrier: ${b.barrier} Charge, ${b.barrierHp} HP |`,
    `| Thruster | ${b.thrusterClimb} levels a step; Dash: ${b.dash} Charge, +${b.dashMove} Move, no zones of control |`,
    `| Med | Mend: ${b.mend} Charge, +${b.mendCore} Core or a limb at ${b.mendPartPct}%; Reboot: ${b.reboot} Charge, stands at ${b.rebootCorePct}% Core |`,
    `| Chance skills | Base + ${sk.perWit}% a Wit band, capped at ${sk.cap}%; Burst adds ${sk.burstRounds} rounds |`,
    `| Items | ${it.max} at most; repair +${it.repairCore} Core; patch mends a limb at ${it.patchPct}%; smoke in range ${it.smokeRange}; cell +${it.cell} Charge |`,
    `| Stride | Break +${st.break}, Draft +${st.draft}, Surge +${st.surge}, Kick +${st.kick} Move |`,
    `| Bench call | Strike ${be.strike} to the Core on one tile; mortar ${be.mortar} to every Core in 3 × 3; repair drop +${be.drop} Core in 3 × 3 |`,
    `| Steel Muster | The volley fills at ${m.volleyFull} attacks; pinning fire −${m.pinPenalty}% hit |`,
  ].join('\n')
}

function live(doc: string, key: string, body: string): string {
  return doc.replace(new RegExp(`<!-- live:${key} -->[\\s\\S]*?<!-- \\/live -->`), `<!-- live:${key} -->\n${body}\n<!-- /live -->`)
}

describe('the manual', () => {
  it('holds the current tuning tables', () => {
    const doc = readFileSync(DOC, 'utf8')
    const current = live(live(doc, 'tuning', tuningTables()), 'tuning2', tuningTables2())
    if (process.env.UPDATE_DOCS === '1') writeFileSync(DOC, current)
    else expect(doc, 'docs/game/battle.md is stale: run pnpm docs:update').toBe(current)
  })
})
