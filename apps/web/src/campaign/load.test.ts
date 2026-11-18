import { createHash } from 'node:crypto'
import { CAMPAIGN_PREVIEW_INDEX, STAND_IN_FILES } from '@cyber/domain'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadCampaign } from './load'

vi.mock('../content/client', () => ({ CONTENT: {} }))

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value))
const files: Record<string, unknown> = {
  ...STAND_IN_FILES,
  'campaign.json': { schemaVersion: 1, draft: true, opening: 'first-watch',
    quests: [{ id: 'first-watch', title: 'First Watch', scene: 'sw1-ch1-s1' }], assets: [], art: [] },
}
const payloads = new Map<string, Uint8Array>()
const entries = Object.entries(files).map(([source, value]) => {
  const bytes = encode(value)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const path = `campaign/files/pack.${sha256}.json`
  payloads.set(path, bytes)
  return { source, bytes: bytes.length, sha256, path }
})

function source(release: string) {
  return {
    pack: async (path: string) => {
      if (path !== CAMPAIGN_PREVIEW_INDEX) {
        const bytes = payloads.get(path)
        if (!bytes) throw new Error('Unexpected path')
        return bytes
      }
      return encode({ schemaVersion: 1, release, files: entries, assets: [] })
    },
  }
}

describe('campaign release recovery', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      setItem: (key: string, value: string) => values.set(key, value),
      getItem: (key: string) => values.get(key) ?? null,
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('opens the last validated release offline, then selects the latest once reconnected', async () => {
    await expect(loadCampaign(source('first-release'), 'owner')).resolves.toMatchObject({ release: { release: 'first-release' } })
    const offline = { pack: (path: string) => {
      if (path === CAMPAIGN_PREVIEW_INDEX) return Promise.reject(Object.assign(new Error('Offline'), { status: null }))
      return source('first-release').pack(path)
    } }
    await expect(loadCampaign(offline, 'owner')).resolves.toMatchObject({ release: { release: 'first-release' } })
    await expect(loadCampaign(offline, 'different-owner')).rejects.toThrow('Offline')
    await expect(loadCampaign(source('next-release'), 'owner')).resolves.toMatchObject({ release: { release: 'next-release' } })
    await expect(loadCampaign(offline, 'owner')).resolves.toMatchObject({ release: { release: 'next-release' } })
  })

  it('does not expose cached content after an explicit authorization denial', async () => {
    await loadCampaign(source('first-release'), 'owner')
    const denied = { pack: async () => { throw Object.assign(new Error('Access denied'), { status: 403 }) } }
    await expect(loadCampaign(denied, 'owner')).rejects.toThrow('Access denied')
  })
})
