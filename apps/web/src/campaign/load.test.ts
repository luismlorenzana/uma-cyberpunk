import { createHash } from 'node:crypto'
import { CAMPAIGN_PREVIEW_INDEX, FOUR_ACT_PREVIEW_INDEX, PILOT_PREVIEW_INDEX, STAND_IN_FILES } from '@cyber/domain'
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

function source(release: string, pointer = CAMPAIGN_PREVIEW_INDEX, campaign?: 'four-act') {
  return {
    pack: async (path: string) => {
      if (path !== pointer) {
        const bytes = payloads.get(path)
        if (!bytes) throw new Error('Unexpected path')
        return bytes
      }
      return encode({ schemaVersion: 1, release, campaign, files: entries, assets: [] })
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

  it('does not use the current cached pointer in the pilot or share the pilot pointer across owners', async () => {
    const offline = { pack: (path: string) => path.endsWith('/pilot.json') || path.endsWith('/preview.json')
      ? Promise.reject(Object.assign(new Error('Offline'), { status: null })) : source('unused').pack(path) }
    await loadCampaign(source('current-release'), 'owner')
    await expect(loadCampaign(offline, 'owner', 'pilot')).rejects.toThrow('Offline')
    await loadCampaign(source('pilot-release', PILOT_PREVIEW_INDEX), 'owner', 'pilot')
    await expect(loadCampaign(offline, 'owner', 'pilot')).resolves.toMatchObject({ release: { release: 'pilot-release' } })
    await expect(loadCampaign(offline, 'owner', 'current')).resolves.toMatchObject({ release: { release: 'current-release' } })
    await expect(loadCampaign(offline, 'other', 'pilot')).rejects.toThrow('Offline')
  })

  it('loads story batches with the same document manifest and refuses a missing document', async () => {
    const pointer = FOUR_ACT_PREVIEW_INDEX
    const config = entries.find(file => file.source === 'campaign.json')!
    const documents = Object.fromEntries(Object.entries(files).filter(([name]) => name !== config.source))
    const payload = encode(documents)
    const sha256 = createHash('sha256').update(payload).digest('hex')
    const story = { path: `campaign/files/pack.${sha256}.json`, sha256, bytes: payload.length, sources: Object.keys(documents) }
    const release = encode({ schemaVersion: 1, release: 'paged', campaign: 'four-act', files: entries, assets: [], storyPages: [story] })
    const requested: string[] = []
    const source = (bundle: Uint8Array) => ({ pack: async (path: string) => {
      requested.push(path)
      if (path === pointer) return release
      if (path === story.path) return bundle
      if (path === config.path) return payloads.get(path)!
      throw new Error('An individual story document was requested')
    } })
    expect((await loadCampaign(source(payload), undefined, 'four-act')).book.opening).toBe('first-watch')
    expect(new Set(requested)).toEqual(new Set([pointer, config.path, story.path]))
    await expect(loadCampaign(source(encode({})), undefined, 'four-act')).rejects.toThrow('is missing')
  })

  it('requires a four-act release and isolates its offline selection', async () => {
    vi.stubGlobal('navigator', {})
    const offline = { pack: (path: string) => path === FOUR_ACT_PREVIEW_INDEX || path === CAMPAIGN_PREVIEW_INDEX
      ? Promise.reject(Object.assign(new Error('Offline'), { status: null })) : source('unused').pack(path) }
    await loadCampaign(source('current-release'), 'owner')
    await expect(loadCampaign(offline, 'owner', 'four-act')).rejects.toThrow('Offline')
    await expect(loadCampaign(source('misplaced', FOUR_ACT_PREVIEW_INDEX), 'owner', 'four-act')).rejects.toThrow('does not belong')
    await expect(loadCampaign(source('misplaced', CAMPAIGN_PREVIEW_INDEX, 'four-act'), 'owner')).rejects.toThrow('does not belong')
    await loadCampaign(source('four-act-release', FOUR_ACT_PREVIEW_INDEX, 'four-act'), 'owner', 'four-act')
    await expect(loadCampaign(offline, 'owner', 'four-act')).resolves.toMatchObject({ release: { release: 'four-act-release' } })
    await expect(loadCampaign(offline, 'owner')).resolves.toMatchObject({ release: { release: 'current-release' } })
    await expect(loadCampaign(offline, 'other', 'four-act')).rejects.toThrow('Offline')
  })
})
