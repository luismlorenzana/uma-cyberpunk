// The manual's starter parts are the code's (CY11): docs/game/hangar.md holds them between `<!-- live:parts -->` and
// `<!-- /live -->`, rendered here from STARTER_PARTS. `pnpm docs:update` rewrites the block; this test fails when stale.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BACK_ROLE, loadOfPart, STARTER_PARTS, type Part } from './parts'
import { ROLE_NAME } from './crew'
import { SQUAD_TUNING } from './squads'

const DOC = join(__dirname, '../../../../docs/game/hangar.md')
const SLOT: Record<Part['slot'], string> = { core: 'Core', arm: 'Arm', legs: 'Legs', back: 'Back unit', visor: 'Visor', hand: 'Hand', coat: 'Coat' }

function numbers(p: Part): string {
  switch (p.slot) {
    case 'core': return [p.capacity ? `+${p.capacity} Capacity` : '', p.hp ? `+${p.hp} Core HP` : ''].filter(Boolean).join(', ') || '—'
    case 'arm': return p.hp ? `+${p.hp} arm HP` : '—'
    case 'legs': return [p.move ? `${p.move > 0 ? '+' : '−'}${Math.abs(p.move)} Move` : '', p.hp ? `+${p.hp} Legs HP` : ''].filter(Boolean).join(', ') || '—'
    case 'back': return [ROLE_NAME[BACK_ROLE[p.kind]], p.capacity ? `+${p.capacity} Capacity` : '', p.weapon ? `Long ${p.weapon.type} ${p.weapon.power} power, ${p.weapon.accuracy}% base, range ${p.weapon.range.join('–')}, ${p.ammo} ammo` : ''].filter(Boolean).join('; ')
    case 'visor': return p.aim ? 'Aim' : '—'
    case 'hand': {
      const i = p.item
      if (i.kind === 'shield') return `Shield, Guard ${i.guard}%`
      return `${i.band[0]!.toUpperCase()}${i.band.slice(1)} ${i.type}, ${i.power} power × ${i.hits}, ${i.accuracy}% base, range ${i.range[0] === i.range[1] ? i.range[0] : i.range.join('–')}${i.twoHanded ? ', two-handed' : ''}`
    }
    case 'coat': return `Halves ${p.type}`
  }
}

export function partsTable(): string {
  return [
    `**${STARTER_PARTS.length} starter parts**, standard issue aboard (every one, any number):`,
    '',
    '| Slot | Part | Load | Numbers | Note |',
    '|---|---|---|---|---|',
    ...STARTER_PARTS.map((p) => `| ${SLOT[p.slot]} | ${p.name} | ${loadOfPart(p)} | ${numbers(p)} | ${p.note === numbers(p) ? '' : p.note} |`),
  ].join('\n')
}

const live = (doc: string, body: string) => doc.replace(/<!-- live:parts -->[\s\S]*?<!-- \/live -->/, `<!-- live:parts -->\n${body}\n<!-- /live -->`)

describe('the manual', () => {
  it('holds the current starter parts', () => {
    const doc = readFileSync(DOC, 'utf8')
    const current = live(doc, partsTable())
    if (process.env.UPDATE_DOCS === '1') writeFileSync(DOC, current)
    else expect(doc).toBe(current)
  })
})

// The squads' numbers (CY18): docs/game/squads.md holds SQUAD_TUNING between `<!-- live:squads -->` and `<!-- /live -->`.
const SQUADS_DOC = join(__dirname, '../../../../docs/game/squads.md')
export function squadsTable(): string {
  const t = SQUAD_TUNING
  return [
    '| Number | Value |',
    '|---|---|',
    `| Squads, members | ${t.maxSquads} squads of ${t.maxMembers} at most |`,
    `| Cohesion levels 1–5 | ${t.cohesion.join(', ')} battles together (three or more members deployed) |`,
    `| Operations on offer | ${t.offered.min} to ${t.offered.max} |`,
    `| Power | level × ${t.power.level} + bond rank × ${t.power.bond} each; cohesion level × ${t.power.cohesion}; ${t.power.partners} a partner pair |`,
    `| Outcome | full at ${t.outcome.full} × danger, partial at ${t.outcome.partial} × danger, else thin |`,
    `| Pay | partial ${t.share.partial * 100}%, thin ${t.share.thin * 100}%; +${t.strain.partial} Strain each for either |`,
    `| Standing | ${t.standing.min} to +${t.standing.max}, start ${t.standing.start} unless the story says; +1 at ${t.freedForStanding} heroines freed |`,
    `| Readiness | ${t.readiness.standing} a standing level above Hostile, ${t.readiness.operation} an operation won in full, ${t.readiness.system} a battle system built |`,
  ].join('\n')
}
describe('the squads manual', () => {
  it('holds the current squad numbers', () => {
    const doc = readFileSync(SQUADS_DOC, 'utf8')
    const current = doc.replace(/<!-- live:squads -->[\s\S]*?<!-- \/live -->/, `<!-- live:squads -->\n${squadsTable()}\n<!-- /live -->`)
    if (process.env.UPDATE_DOCS === '1') writeFileSync(SQUADS_DOC, current)
    else expect(doc).toBe(current)
  })
})
