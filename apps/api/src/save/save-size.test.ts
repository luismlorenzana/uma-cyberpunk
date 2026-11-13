// Save v1 in one document: far under Firestore's 1 MB document and the API's 1 MB body (as uma-quest's size test). Each
// save version that grows the save (CY9's story state, CY10's crew, ship and worlds) adds its full case here. Invented
// data only.
import { newSave, parseSave } from '@cyber/domain'
import { describe, expect, it } from 'vitest'

const bytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length

describe('the save in one document', () => {
  it('fits save v1 many times over', () => {
    const save = parseSave(newSave('u'.repeat(128), '2026-11-12T12:00:00.000Z'))
    expect(bytes(save)).toBeLessThan(1024)
  })
})
