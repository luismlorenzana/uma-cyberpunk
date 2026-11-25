import { describe, expect, it } from 'vitest'
import { managementReceipt } from '../campaign-management'
import { newSave, parseSave } from './save'

const NOW = '2026-11-19T00:00:00Z'
describe('management save migration and receipts', () => {
  it('preserves v17 story, clock, projects and cabin rotation while adding an empty receipt ledger', () => {
    const { expedition: _expedition, commandCinema: _cinema1, management: _, ...prior } = newSave('captain', NOW)
    const old = { ...prior, version: 17, campaignProjects: { depot: 1 }, cabinVisits: { officer: 3 } }
    const save = parseSave(old)
    expect(save.version).toBe(21)
    expect(save.account.updatedAt).toBe(NOW)
    expect(save.campaignProjects).toEqual(old.campaignProjects)
    expect(save.cabinVisits).toEqual(old.cabinVisits)
    expect(save.story).toEqual(old.story)
    expect(save.management).toEqual({ sequence: 0, receipts: [], acknowledged: [] })
  })
  it('bounds the receipt history without moving timestamps or removing independent acknowledgements', () => {
    let save = newSave('captain', NOW)
    save = { ...save, management: { ...save.management, acknowledged: ['location:bridge'] } }
    for (let i = 0; i < 40; i++) save = managementReceipt(save, { kind: 'shipment', subject: 'alloy', destination: 'ship', amount: 4 })
    expect(save.management.receipts).toHaveLength(32)
    expect(save.management.sequence).toBe(40)
    expect(save.management.receipts[0]!.sequence).toBe(9)
    expect(save.account.updatedAt).toBe(NOW)
    expect(parseSave(JSON.parse(JSON.stringify(save)))).toEqual(save)
  })
  it('refuses invalid receipts, duplicate acknowledgements and newer fields disguised as an older save', () => {
    const save = managementReceipt(newSave('captain', NOW), { kind: 'shipment', subject: 'alloy', destination: 'hangar', amount: 4 })
    for (const receipt of [
      { ...save.management.receipts[0], amount: 0 }, { ...save.management.receipts[0], day: 2 },
      { ...save.management.receipts[0], sequence: 2 }, { ...save.management.receipts[0], kind: 'free-money' },
    ]) expect(() => parseSave({ ...save, management: { ...save.management, receipts: [receipt] } })).toThrow()
    expect(() => parseSave({ ...save, management: { ...save.management, acknowledged: ['first', 'first'] } })).toThrow()
    const { expedition: _expedition, commandCinema: _, ...before19 } = save
    expect(() => parseSave({ ...before19, version: 17 })).toThrow('version 18')
  })
})
