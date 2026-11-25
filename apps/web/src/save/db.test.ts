import 'fake-indexeddb/auto'
import { newSave } from '@cyber/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addSafetyCopy, clearDevice, readSaveRow, SAFETY_COPIES, safetyCopies, writeSaveRow } from './db'

const T0 = '2026-11-08T12:00:00.000Z'

describe('the device save', () => {
  beforeEach(() => clearDevice())

  it('round-trips the save row for its own account only', async () => {
    await writeSaveRow({ id: 'main', uid: 'a', revision: 2, save: newSave('a', T0), dirty: false, lastSyncedAt: T0 })
    expect(await readSaveRow('a')).toEqual({ id: 'main', uid: 'a', revision: 2, save: newSave('a', T0), dirty: false, lastSyncedAt: T0 })
    expect(await readSaveRow('b')).toBeNull()
  })

  it('keeps an unreadable row as a safety copy and reads as empty', async () => {
    await writeSaveRow({ id: 'main', uid: 'a', revision: 1, save: { version: 9 } as never, dirty: true, lastSyncedAt: null })
    expect(await readSaveRow('a')).toBeNull()
    expect((await safetyCopies('a')).map((c) => c.reason)).toEqual(['unreadable'])
  })

  it('keeps the newest five safety copies an account', async () => {
    for (let i = 0; i < SAFETY_COPIES + 2; i++) await addSafetyCopy({ uid: 'a', reason: 'replaced', at: T0, revision: i, save: newSave('a', T0) })
    await addSafetyCopy({ uid: 'b', reason: 'replaced', at: T0, revision: 99, save: newSave('b', T0) })
    expect((await safetyCopies('a')).map((c) => c.revision)).toEqual([6, 5, 4, 3, 2])
    expect((await safetyCopies('b')).map((c) => c.revision)).toEqual([99])
  })

  it('keeps campaign rows and safety copies separate for the same account', async () => {
    const original = newSave('a', T0)
    await writeSaveRow({ id: 'main', uid: 'a', revision: 4, save: original, dirty: false, lastSyncedAt: T0 })
    await addSafetyCopy({ uid: 'a', reason: 'restore', at: T0, revision: 3, save: original })
    vi.resetModules()
    vi.doMock('../app/campaign', () => ({ saveScope: 'current' }))
    try {
      const campaign = await import('./db')
      await campaign.clearDevice()
      expect(await campaign.readSaveRow('a')).toBeNull()
      expect(await campaign.safetyCopies('a')).toEqual([])
      await campaign.writeSaveRow({ id: 'main', uid: 'a', revision: 1, save: original, dirty: false, lastSyncedAt: T0 })
      await campaign.addSafetyCopy({ uid: 'a', reason: 'restore', at: T0, revision: 1, save: original })
      vi.resetModules()
      vi.doMock('../app/campaign', () => ({ saveScope: 'pilot' }))
      const pilot = await import('./db')
      await pilot.clearDevice()
      expect(await pilot.readSaveRow('a')).toBeNull()
      expect(await pilot.safetyCopies('a')).toEqual([])
      await pilot.writeSaveRow({ id: 'main', uid: 'a', revision: 2, save: original, dirty: true, lastSyncedAt: null })
      await pilot.addSafetyCopy({ uid: 'a', reason: 'restore', at: T0, revision: 2, save: original })
      vi.resetModules()
      vi.doMock('../app/campaign', () => ({ saveScope: 'legacy' }))
      const legacy = await import('./db')
      await legacy.clearDevice()
      expect(await legacy.readSaveRow('a')).toBeNull()
      expect(await legacy.safetyCopies('a')).toEqual([])
      await legacy.writeSaveRow({ id: 'main', uid: 'a', revision: 5, save: original, dirty: false, lastSyncedAt: T0 })
      await legacy.addSafetyCopy({ uid: 'a', reason: 'restore', at: T0, revision: 5, save: original })
      expect((await legacy.readSaveRow('a'))?.revision).toBe(5)
      expect((await legacy.safetyCopies('a')).map((copy) => copy.revision)).toEqual([5])
      expect((await campaign.readSaveRow('a'))?.revision).toBe(1)
      expect((await campaign.safetyCopies('a')).map((copy) => copy.revision)).toEqual([1])
      expect((await pilot.readSaveRow('a'))?.revision).toBe(2)
      expect((await pilot.safetyCopies('a')).map((copy) => copy.revision)).toEqual([2])
      expect((await readSaveRow('a'))?.revision).toBe(4)
      expect((await safetyCopies('a')).map((copy) => copy.revision)).toEqual([3])
    } finally {
      vi.doUnmock('../app/campaign')
    }
  })
})
