import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'

export interface StoredObject { bytes: Buffer; generation: string }
export interface ArtStorage {
  read(path: string): Promise<StoredObject | null>
  put(path: string, bytes: Buffer, generation: string, immutable?: boolean): Promise<void>
}
export class GenerationConflict extends Error {}
export const ART_BUCKET = 'uma-platform-content'
export const CAMPAIGN_PREFIX = 'campaign/cyberpunk/'
export const SCENE_SPLASH_PREFIX = 'art/universes/cyberpunk/scene-splashes/'
export const COMBAT_SPRITE_PREFIX = 'art/universes/cyberpunk/combat-sprites/'
export const SOURCE_PREFIXES = ['art/universes/cyberpunk/', 'enemy-art/cyberpunk/'] as const

export function safeObject(path: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(path) || path.split('/').some(s => !s || s === '.' || s === '..')) {
    throw new Error(`Unsafe storage path: ${path}`)
  }
  return path
}

/** Cyberpunk write scopes are selected explicitly for campaign or Platform combat sprites. */
export class GcsArtStorage implements ArtStorage {
  private token: Promise<string> | undefined
  constructor(private readonly request: typeof fetch = fetch, private readonly accessToken = async () => {
    const run = promisify(execFile)
    const args = ['auth', 'print-access-token']
    const result = process.platform === 'win32'
      ? await run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'gcloud.cmd auth print-access-token'], { windowsHide: true })
      : await run('gcloud', args)
    const token = result.stdout.trim()
    if (!token || /\s/.test(token)) throw new Error('No Google Cloud access token')
    return token
  }, private readonly writePrefix: typeof CAMPAIGN_PREFIX | typeof COMBAT_SPRITE_PREFIX | typeof SCENE_SPLASH_PREFIX = CAMPAIGN_PREFIX) {}

  private async headers() {
    this.token ??= this.accessToken()
    return { Authorization: `Bearer ${await this.token}` }
  }
  async read(path: string): Promise<StoredObject | null> {
    safeObject(path)
    if (![CAMPAIGN_PREFIX, ...SOURCE_PREFIXES].some(prefix => path.startsWith(prefix))) throw new Error('Read outside Cyberpunk content')
    const response = await this.request(`https://storage.googleapis.com/storage/v1/b/${ART_BUCKET}/o/${encodeURIComponent(path)}?alt=media`, {
      headers: await this.headers(), cache: 'no-store', signal: AbortSignal.timeout(60_000),
    })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Read ${path}: HTTP ${response.status}`)
    const generation = response.headers.get('x-goog-generation')
    if (!generation || !/^\d+$/.test(generation)) throw new Error(`Missing generation for ${path}`)
    return { bytes: Buffer.from(await response.arrayBuffer()), generation }
  }
  async put(path: string, bytes: Buffer, generation: string, immutable = false): Promise<void> {
    safeObject(path)
    if (!path.startsWith(this.writePrefix) || !/^\d+$/.test(generation)) throw new Error('Write outside Cyberpunk scope or missing precondition')
    const boundary = `cyber-${randomUUID()}`
    const metadata = { name: path, cacheControl: immutable ? 'private,max-age=31536000,immutable' : 'private,no-store' }
    const mime = path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'application/json'
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),
      bytes, Buffer.from(`\r\n--${boundary}--\r\n`),
    ])
    const response = await this.request(`https://storage.googleapis.com/upload/storage/v1/b/${ART_BUCKET}/o?uploadType=multipart&ifGenerationMatch=${generation}`, {
      method: 'POST', headers: { ...await this.headers(), 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: Uint8Array.from(body), signal: AbortSignal.timeout(60_000),
    })
    if (response.status === 412) throw new GenerationConflict(`${path} changed; rebuild on the new selection`)
    if (!response.ok) throw new Error(`Write ${path}: HTTP ${response.status}`)
  }
}
