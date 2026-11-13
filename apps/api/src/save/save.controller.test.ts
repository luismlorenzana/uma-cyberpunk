// A refused upload is kept (uma-rpg D260), a conflict carries what's stored, and nothing else is written. Invented data only.
import { BadRequestException, ConflictException } from '@nestjs/common'
import { newSave, type Save } from '@cyber/domain'
import { describe, expect, it, vi } from 'vitest'
import { SaveController } from './save.controller'
import { EMPTY_ENVELOPE, RevisionConflict, type SaveRepository } from './save.repository'

const NOW = '2026-11-08T12:00:00.000Z'
const upload = () => ({ baseRevision: 3, save: JSON.parse(JSON.stringify(newSave('u', NOW))) as Save })
function fake(put: SaveRepository['put'], rescue: SaveRepository['rescue'] = vi.fn(async () => undefined)) {
  const repo: SaveRepository = { load: async () => EMPTY_ENVELOPE, put, rescue }
  return { repo, controller: new SaveController(repo) }
}

describe('GET /api/save', () => {
  it('answers the stored envelope, empty before the first upload', async () => {
    await expect(fake(async () => EMPTY_ENVELOPE).controller.load('u')).resolves.toEqual({ revision: 0, save: null })
  })
})

describe('PUT /api/save', () => {
  it('stores the upload and keeps nothing aside', async () => {
    const put = vi.fn(async (_uid: string, revision: number, save: Save) => ({ revision: revision + 1, save }))
    const { repo, controller } = fake(put)
    await expect(controller.put('u', upload())).resolves.toMatchObject({ revision: 4 })
    expect(put).toHaveBeenCalledWith('u', 3, upload().save, 2)
    expect(repo.rescue).not.toHaveBeenCalled()
  })

  it('stores the save exactly as sent: the server never moves account.updatedAt', async () => {
    const { controller } = fake(async (_uid, revision, save) => ({ revision: revision + 1, save }))
    const stored = await controller.put('u', upload())
    expect(stored.save?.account.updatedAt).toBe(NOW)
  })

  it('keeps an upload the store refuses, as sent, and still fails it', async () => {
    const { repo, controller } = fake(async () => { throw new Error('3 INVALID_ARGUMENT: invalid nested entity') })
    const body = upload()
    await expect(controller.put('u', body)).rejects.toThrow('invalid nested entity')
    expect(repo.rescue).toHaveBeenCalledWith('u', body, '3 INVALID_ARGUMENT: invalid nested entity')
  })

  it('keeps an upload that fails the save rules, as sent, and says why', async () => {
    const { repo, controller } = fake(async () => { throw new Error('never stored') })
    const body = { baseRevision: 3, save: { version: 1, nonsense: true } }
    await expect(controller.put('u', body)).rejects.toBeInstanceOf(BadRequestException)
    expect(repo.rescue).toHaveBeenCalledWith('u', body, expect.any(String))
  })

  it('keeps nothing for a revision conflict and returns what is stored', async () => {
    const stored = { revision: 7, save: newSave('u', NOW) }
    const { repo, controller } = fake(async () => { throw new RevisionConflict(stored) })
    const error = await controller.put('u', upload()).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ConflictException)
    expect((error as ConflictException).getResponse()).toMatchObject({ current: stored })
    expect(repo.rescue).not.toHaveBeenCalled()
  })

  it('never lets a failed rescue hide why the upload failed', async () => {
    const { controller } = fake(async () => { throw new Error('the real reason') }, async () => { throw new Error('no rescue') })
    await expect(controller.put('u', upload())).rejects.toThrow('the real reason')
  })
})
