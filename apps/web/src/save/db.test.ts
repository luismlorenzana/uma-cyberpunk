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
    vi.doMock('../app/campaign', () => ({ inCampaign: true }))
    try {
      const campaign = await import('./db')
      await campaign.clearDevice()
      expect(await campaign.readSaveRow('a')).toBeNull()
      expect(await campaign.safetyCopies('a')).toEqual([])
      await campaign.writeSaveRow({ id: 'main', uid: 'a', revision: 1, save: original, dirty: false, lastSyncedAt: T0 })
      await campaign.addSafetyCopy({ uid: 'a', reason: 'restore', at: T0, revision: 1, save: original })
      expect((await readSaveRow('a'))?.revision).toBe(4)
      expect((await safetyCopies('a')).map((copy) => copy.revision)).toEqual([3])
    } finally {
      vi.doUnmock('../app/campaign')
    }
  })
})
