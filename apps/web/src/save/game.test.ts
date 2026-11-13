// The sync engine against a fake server: a fresh account reaches the server, a device save boots without waiting, a
// conflict reconciles, and an account started offline never replaces the server's. Invented data only.
import 'fake-indexeddb/auto'
import { newSave, touched, type Save, type SaveEnvelope } from '@cyber/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearDevice, readSaveRow, safetyCopies, writeSaveRow } from './db'

const server = vi.hoisted(() => ({ envelope: { revision: 0, save: null } as SaveEnvelope, offline: false, puts: 0, raceOnce: null as SaveEnvelope | null }))

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    saveApi: {
      load: async () => {
        if (server.offline) throw new TypeError('Failed to fetch')
        return structuredClone(server.envelope)
      },
      put: async (baseRevision: number, save: Save) => {
        if (server.offline) throw new TypeError('Failed to fetch')
        server.puts++
        if (server.raceOnce) {
          server.envelope = server.raceOnce
          server.raceOnce = null
        }
        if (baseRevision !== server.envelope.revision) throw new actual.ApiError('/api/save', 409, { current: server.envelope })
        server.envelope = { revision: baseRevision + 1, save: structuredClone(save) }
        return structuredClone(server.envelope)
      },
    },
  }
})

const { boot, resetGame, restoreSafetyCopy, syncNow, useGame } = await import('./game')
const T0 = '2026-11-08T12:00:00.000Z'
const T1 = '2026-11-08T12:05:00.000Z'
const settle = async () => {
  await new Promise((r) => setTimeout(r, 5))
  await syncNow()
}

beforeEach(async () => {
  resetGame()
  await clearDevice()
  Object.assign(server, { envelope: { revision: 0, save: null }, offline: false, puts: 0, raceOnce: null })
})

describe('boot and sync', () => {
  it('starts a new account and stores it on the server as revision 1', async () => {
    await boot('u')
    await settle()
    const state = useGame.getState()
    expect(state.status).toBe('ready')
    expect(state.save?.account.uid).toBe('u')
    expect(state).toMatchObject({ revision: 1, dirty: false, sync: 'synced' })
    expect(server.envelope.revision).toBe(1)
    expect((await readSaveRow('u'))?.revision).toBe(1)
  })

  it("opens the server's save on a fresh device, without writing", async () => {
    server.envelope = { revision: 4, save: newSave('u', T0) }
    await boot('u')
    expect(useGame.getState()).toMatchObject({ revision: 4, dirty: false, save: newSave('u', T0) })
    expect(server.puts).toBe(0)
  })

  it('opens the device save first and then syncs', async () => {
    server.envelope = { revision: 2, save: newSave('u', T0) }
    await writeSaveRow({ id: 'main', uid: 'u', revision: 2, save: touched(newSave('u', T0), T1), dirty: true, lastSyncedAt: null })
    await boot('u')
    expect(useGame.getState().save?.account.updatedAt).toBe(T1)
    await settle()
    expect(server.envelope).toEqual({ revision: 3, save: touched(newSave('u', T0), T1) })
  })

  it('reconciles a conflict: another device wrote first, this one changed last, so it pushes over', async () => {
    await writeSaveRow({ id: 'main', uid: 'u', revision: 2, save: touched(newSave('u', T0), T1), dirty: true, lastSyncedAt: null })
    server.envelope = { revision: 2, save: newSave('u', T0) }
    server.raceOnce = { revision: 3, save: newSave('u', T0) }
    await boot('u')
    await settle()
    expect(server.envelope).toEqual({ revision: 4, save: touched(newSave('u', T0), T1) })
    expect(useGame.getState()).toMatchObject({ revision: 4, dirty: false })
  })

  it("keeps an account started offline aside and adopts the server's once online (D11)", async () => {
    server.offline = true
    await boot('u')
    await settle()
    expect(useGame.getState()).toMatchObject({ revision: 0, dirty: true, sync: 'error' })
    server.offline = false
    server.envelope = { revision: 5, save: newSave('u', '2026-11-01T00:00:00.000Z') }
    await syncNow()
    expect(useGame.getState()).toMatchObject({ revision: 5, dirty: false, save: server.envelope.save })
    expect((await safetyCopies('u')).map((c) => c.reason)).toEqual(['replaced'])
    expect(server.puts).toBe(0)
  })

  it('restores a safety copy as the newest change, keeping what it replaced', async () => {
    server.offline = true
    await boot('u')
    await settle()
    server.offline = false
    server.envelope = { revision: 5, save: newSave('u', '2026-11-01T00:00:00.000Z') }
    await syncNow()
    const [copy] = await safetyCopies('u')
    expect(await restoreSafetyCopy(copy!.id!)).toBe(true)
    await settle()
    expect(useGame.getState()).toMatchObject({ dirty: false, sync: 'synced', revision: 6 })
    expect(Date.parse(useGame.getState().save!.account.updatedAt)).toBeGreaterThan(Date.parse('2026-11-01T00:00:00.000Z'))
    expect((await safetyCopies('u')).map((c) => c.reason)).toEqual(['restore'])
  })
})
