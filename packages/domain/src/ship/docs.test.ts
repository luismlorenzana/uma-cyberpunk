// The manual's module and project tables are the code's (CY15): docs/game/ship-build.md holds them between
// `<!-- live:modules -->` / `<!-- live:projects -->` and `<!-- /live -->`. `pnpm docs:update` rewrites them; this test
// fails when either is stale.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BRANCH_NAME, MODULES, PROJECTS, PROJECTS_BY_ID, type Cost } from './modules'
import { POSTS, POST_KINDS } from './duties'

const DOC = join(__dirname, '../../../../docs/game/ship-build.md')
const DUTIES = join(__dirname, '../../../../docs/game/duties.md')
const cost = (c: Cost) => [c.credits && `${c.credits} cr`, c.alloy && `${c.alloy} alloy`, c.data && `${c.data} data`].filter(Boolean).join(', ') || 'free'
const unlock = (u: (typeof MODULES)[number]['unlock']) => (u === 'placed' ? 'Placed at a new game' : u === 'start' ? 'From the start' : u === 'lead' ? 'A lead’s `opens`' : `Research: ${PROJECTS_BY_ID.get(u.research)!.name}`)

export function modulesBlock(): string {
  return [
    `**${MODULES.length} modules:**`,
    '',
    '| Module | Kind | Slots | Pips | Unlock | Level 1 | Level 2 | Level 3 |',
    '|---|---|---|---|---|---|---|---|',
    ...MODULES.map((m) => `| ${m.name} | ${m.kind === 'room' ? 'Room' : 'Battle system'} (${m.family}) | ${m.width} | ${m.pips ?? '—'} | ${unlock(m.unlock)} | ${m.levels.map((l) => `${l.adds} (${cost(l.cost)}; ${l.watches} w)`).join(' | ')} |`),
  ].join('\n')
}

export function projectsBlock(): string {
  return [
    `**${PROJECTS.length} projects:**`,
    '',
    '| Branch | Project | Data | Watches | Needs | Does |',
    '|---|---|---|---|---|---|',
    ...PROJECTS.map((p) => `| ${BRANCH_NAME[p.branch]} | ${p.name} | ${p.data} | ${p.watches} | ${p.needs.map((n) => PROJECTS_BY_ID.get(n)!.name).join(', ') || '—'} | ${p.does} |`),
  ].join('\n')
}

export function postsBlock(): string {
  return [
    `**${POST_KINDS.length} posts:**`,
    '',
    '| Post | Best band | Makes a watch | At band 4–5 | Role perk |',
    '|---|---|---|---|---|',
    ...POST_KINDS.map((k) => { const p = POSTS[k]; return `| ${p.name} | ${p.bands.join(' or ')} | ${p.does} | ${p.extra} | ${p.role ? `${p.role}: ${p.perk}` : '—'} |` }),
  ].join('\n')
}

const live = (doc: string, key: string, body: string) => doc.replace(new RegExp(`<!-- live:${key} -->[\\s\\S]*?<!-- /live -->`), `<!-- live:${key} -->\n${body}\n<!-- /live -->`)

describe('the manual', () => {
  it('holds the current modules and projects', () => {
    const doc = readFileSync(DOC, 'utf8').replaceAll('\r\n', '\n')
    const current = live(live(doc, 'modules', modulesBlock()), 'projects', projectsBlock())
    if (process.env.UPDATE_DOCS === '1') writeFileSync(DOC, current)
    else expect(doc).toBe(current)
  })
  it('holds the current posts', () => {
    const doc = readFileSync(DUTIES, 'utf8').replaceAll('\r\n', '\n')
    const current = live(doc, 'posts', postsBlock())
    if (process.env.UPDATE_DOCS === '1') writeFileSync(DUTIES, current)
    else expect(doc).toBe(current)
  })
})
