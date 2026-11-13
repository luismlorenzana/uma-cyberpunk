import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { newSave, touched } from '@cyber/domain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalSaveRepository } from './local-save.repository'
import { RevisionConflict } from './save.repository'

const T0 = '2026-11-08T12:00:00.000Z'
const T1 = '2026-11-08T12:05:00.000Z'
let dir = ''
let repo: LocalSaveRepository
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cyber-save-'))
  repo = new LocalSaveRepository(join(dir, 'save.json'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('the local save store (dev)', () => {
  it('is empty before the first upload', async () => expect(await repo.load('u')).toEqual({ revision: 0, save: null }))

  it('round-trips a save and counts revisions', async () => {
    expect(await repo.put('u', 0, newSave('u', T0), 2)).toEqual({ revision: 1, save: newSave('u', T0) })
    expect(await repo.put('u', 1, touched(newSave('u', T0), T1), 2)).toMatchObject({ revision: 2 })
    expect(await repo.load('u')).toEqual({ revision: 2, save: touched(newSave('u', T0), T1) })
  })

  it('keeps accounts apart', async () => {
    await repo.put('a', 0, newSave('a', T0), 2)
    expect(await repo.load('b')).toEqual({ revision: 0, save: null })
  })

  it('refuses a stale revision with what is stored', async () => {
    await repo.put('u', 0, newSave('u', T0), 2)
    const error = await repo.put('u', 0, newSave('u', T1), 2).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RevisionConflict)
    expect((error as RevisionConflict).current).toEqual({ revision: 1, save: newSave('u', T0) })
  })

  it('serializes concurrent writes: one wins, one conflicts', async () => {
    const results = await Promise.allSettled([repo.put('u', 0, newSave('u', T0), 2), repo.put('u', 0, newSave('u', T1), 2)])
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected'])
  })

  it('keeps a refused upload beside the file', async () => {
    await repo.rescue('u', { junk: true }, 'bad')
    expect(JSON.parse(await readFile(join(dir, 'save.json.rescue.json'), 'utf8'))).toEqual({ uid: 'u', reason: 'bad', upload: { junk: true } })
  })
})
