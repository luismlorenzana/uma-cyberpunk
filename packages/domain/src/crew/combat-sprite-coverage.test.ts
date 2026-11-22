import { expect, it } from 'vitest'
import coverage from '../../../../docs/handoff/combat-sprite-coverage.json'
import { PARTS_BY_ID } from './parts'

it('tracks one art treatment for every current Hangar or campaign equipment ID', () => {
  const entries = coverage.parts.map(({ id, slot }) => [id, slot] as const)
  expect(entries).toHaveLength(PARTS_BY_ID.size)
  expect(new Map(entries)).toEqual(new Map([...PARTS_BY_ID].map(([id, part]) => [id, part.slot])))
})
