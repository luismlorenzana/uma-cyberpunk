// The save in one document: far under Firestore's 1 MB document and the API's 1 MB body (as uma-quest's size test). Each
// version that grows the save adds its full case here. Invented data only.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bestRig, newSave, parseSave } from '@cyber/domain'
import { describe, expect, it } from 'vitest'

const bytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length

describe('the save in one document', () => {
  it('fits a new save many times over', () => {
    expect(bytes(parseSave(newSave('u'.repeat(128), '2026-11-12T12:00:00.000Z')))).toBeLessThan(1024)
  })
  it('fits a late game: 60 crew with rigs and three loadouts each, 300 flags and scenes, 40 Files, 12 worlds, and a mission mid-battle (v4)', () => {
    const map = JSON.parse(readFileSync(resolve(__dirname, '../../../../scenarios/maps/underlevels-14.json'), 'utf8'))
    const scenario = JSON.parse(readFileSync(resolve(__dirname, '../../../../scenarios/sandbox-muster.json'), 'utf8'))
    const slug = (p: string, i: number) => `${p}-${String(i).padStart(4, '0')}-a-longish-slug`
    const save = {
      ...newSave('u', '2026-11-12T12:00:00.000Z'),
      crew: Array.from({ length: 60 }, (_, i) => {
        const rig = bestRig('vanguard', { speed: 3, stamina: 3, power: 3, guts: 3, wit: 3 })
        return { outfit: 9_000_001 + i, xp: 99_999, role: 'vanguard', rig, presets: [0, 1, 2].map((j) => ({ name: `A long loadout name ${j}xx`.slice(0, 24), rig })), strain: 2 }
      }),
      worlds: { current: 'w1', known: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`w${i}`, { cleared: Array.from({ length: 20 }, (_, j) => slug(`w${i}`, j)) }])), missions: Array.from({ length: 200 }, (_, i) => slug('m', i)) },
      story: {
        flags: Array.from({ length: 300 }, (_, i) => slug('f', i)), leads: Array.from({ length: 150 }, (_, i) => slug('l', i)), seen: Array.from({ length: 300 }, (_, i) => slug('s', i)),
        files: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [slug('file', i), [0, 1, 2, 3, 4]])), anomalies: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [slug('a', i), i % 2 === 0])),
      },
      mission: { id: 'm', chapter: 'c', step: 'battle', squad: [9000001, 9000002, 9000003, 9000004], won: null,
        battle: { input: { ...scenario.input, seed: 'x:1', map }, actions: Array.from({ length: 400 }, (_, i) => ({ kind: 'turn', unit: 'android-1', to: [i % 14, (i * 3) % 14], act: { kind: 'attack', with: 'right', target: 'vanguard-a' }, face: 'N' })) } },
    }
    const size = bytes(parseSave(JSON.parse(JSON.stringify(save))))
    expect(size).toBeLessThan(200_000)
  })
})
