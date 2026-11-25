// The save in one document: far under Firestore's 1 MB document and the API's 1 MB body (as uma-quest's size test). Each
// version that grows the save adds its full case here. Invented data only.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bestRig, ITEMS, MODULES, newSave, parseSave, PROJECTS, type ExpeditionMember } from '@cyber/domain'
import { describe, expect, it } from 'vitest'

const bytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length

describe('the save in one document', () => {
  it('fits a new save many times over', () => {
    expect(bytes(parseSave(newSave('u'.repeat(128), '2026-11-12T12:00:00.000Z')))).toBeLessThan(2048)
  })
  it.each([
    { crew: 60, history: 300, missions: 200, actions: 400, squad: 4, longIds: false, limit: 200_000 },
    { crew: 250, history: 1600, missions: 500, actions: 1500, squad: 10, longIds: false, limit: 1024 * 1024 },
    // The full campaign has 100 permanent crew. Its 150 lieutenant returns live in story history.
    { crew: 100, history: 3500, missions: 800, actions: 1500, squad: 10, longIds: true, limit: 920 * 1024 },
  ])('fits $crew fully equipped crew and $actions recorded battle actions', (profile) => {
    const map = JSON.parse(readFileSync(resolve(__dirname, '../../../../scenarios/maps/underlevels-14.json'), 'utf8')) as { spawns: { squad: number[][]; enemy: number[][] } }
    const scenario = JSON.parse(readFileSync(resolve(__dirname, '../../../../scenarios/sandbox-muster.json'), 'utf8')) as { input: { units: { id: string; side: string; spawn: number }[] } }
    const ordinary = { ...scenario.input, seed: 'x:1', map }
    const template = ordinary.units.find(unit => unit.side === 'squad')!
    const suffix = profile.longIds ? 'long-record-identifier-'.repeat(3).slice(0, 52) : 'a-longish-slug'
    const slug = (p: string, i: number) => `${p}-${String(i).padStart(4, '0')}-${suffix}`
    const members: ExpeditionMember[] = [
      { role: 'uma', outfit: 9_000_001 }, { role: 'uma', outfit: 9_000_002 },
      ...(['boss-ally', 'melee-shield', 'ranged-medic', 'long-range'] as const).flatMap((role, group) =>
        [0, 1].map(index => ({ role, heroine: slug('actor', 50 + 2 * group + index) }))),
    ]
    const input = profile.squad === 4 ? ordinary : {
      ...ordinary, rulesVersion: 7, bench: [],
      map: { ...map, schemaVersion: 2, spawns: { ...map.spawns, squad: [...map.spawns.squad, [0, 13], [1, 13], [7, 13], [8, 13], [9, 13]] } },
      units: [...ordinary.units.filter(unit => unit.side === 'enemy'), ...Array.from({ length: profile.squad }, (_, spawn) => ({
        ...template, id: `member-${spawn}`, spawn, ref: 'outfit' in members[spawn]! ? { kind: 'uma' as const, id: String(9_000_001 + spawn) }
          : { kind: 'heroine' as const, id: slug('actor', 48 + spawn) },
      }))],
    }
    const rig = bestRig('vanguard', { speed: 3, stamina: 3, power: 3, guts: 3, wit: 3 })
    const save = {
      ...newSave('u', '2026-11-12T12:00:00.000Z'), inbox: Array.from({ length: profile.crew }, (_, i) => 9_000_001 + i), watch: 9999,
      items: Object.fromEntries(ITEMS.map((it) => [it.id, 9999])), visits: { watch: 9999, used: 3 }, wallet: { credits: 9_999_999, alloy: 999_999, data: 999_999 },
      ship: { decks: 6, width: 6, unlocked: MODULES.map((m) => m.id), powered: ['battery', 'sensors'], research: { done: PROJECTS.map((p) => p.id), current: null },
        modules: (() => { let deck = 0, slot = 0; return MODULES.map((m) => { if (slot + m.width > 6) { deck++; slot = 0 } const at = { id: m.id, deck, slot, level: 3, building: null }; slot += m.width; return at }) })() },
      crew: Array.from({ length: profile.crew }, (_, i) => {
        return { outfit: 9_000_001 + i, ...(i >= 50 && profile.crew > 60 ? { heroine: slug('actor', i), ...(i < 52 ? { expeditionOnly: true } : {}) } : {}), xp: 99_999, role: 'vanguard', rig, presets: [0, 1, 2].map((j) => ({ name: `A long loadout name ${j}xx`.slice(0, 24), rig })), strain: 2, bond: { rank: 10, rapport: 0, path: 'heart', seen: [2, 4, 6, 8, 10] }, cabin: { slots: { bed: 'neon-bed', desk: 'neon-desk', wall: 'neon-wall', floor: 'neon-floor', light: 'neon-light', keepsake: 'keepsake-photo' }, revealed: ['gift', 'styles', 'topic:racing', 'topic:food'], request: 'light' }, post: { module: 'bridge', index: 0, since: 1, mastery: 99 } }
      }),
      worlds: { current: 'w1', known: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`w${i}`, { cleared: Array.from({ length: 20 }, (_, j) => slug(`w${i}`, j)) }])), missions: Array.from({ length: profile.missions }, (_, i) => slug('m', i)) },
      story: {
        flags: Array.from({ length: profile.history }, (_, i) => slug('f', i)), leads: Array.from({ length: 150 }, (_, i) => slug('l', i)), seen: Array.from({ length: profile.history }, (_, i) => slug('s', i)),
        files: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [slug('file', i), [0, 1, 2, 3, 4]])), anomalies: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [slug('a', i), i % 2 === 0])),
      },
      expedition: profile.squad === 10 ? { duo: 'duo-1', ship: 'ship-1', members, fuel: 3, provisions: 6 } : null,
      mission: { id: 'm', chapter: 'c', step: 'battle', squad: Array.from({ length: profile.squad }, (_, index) => 9_000_001 + index), won: null,
        battle: { input, actions: Array.from({ length: profile.actions }, (_, i) => ({ kind: 'turn', unit: 'android-1', to: [i % 14, (i * 3) % 14], act: { kind: 'attack', with: 'right', target: 'vanguard-a' }, face: 'N' })) } },
    }
    const parsed = parseSave(JSON.parse(JSON.stringify(save)))
    expect(parsed.crew).toHaveLength(profile.crew)
    expect(parsed.mission?.squad).toHaveLength(profile.squad)
    expect(parsed.expedition?.members.length ?? 0).toBe(profile.squad === 10 ? 10 : 0)
    expect(bytes({ baseRevision: 1, save: parsed })).toBeLessThan(profile.limit)
  })
})
