// Master data (CY3, CY11): the release's manifest, then its characters, outfits and art index through cyber-api's proxy,
// cached by hash on the device (uma-kit's content loader; uma-farm's master.ts in shape, cut to what the crew reads).
// The game's view of it is each outfit's 5★ stats and running-style grades (the crew's one adapter, in @cyber/domain),
// her album row's name, and the art index for faces and busts. Nothing from it is ever stored in git or the save.
import type { OutfitInfo } from '@cyber/domain'
import type { ArtIndex } from '@luismlorenzana/uma-data'
import { outfitRowBase } from '@luismlorenzana/uma-kit/roster'
import { useSyncExternalStore } from 'react'
import { CONTENT } from '../content/client'
import { setNameSource } from '../story/runner'

export interface MasterView {
  version: string
  /** Each outfit's 5★ stats and running-style grades, by outfit id. */
  info: ReadonlyMap<number, OutfitInfo>
  /** Each outfit's album name, by outfit id. */
  names: ReadonlyMap<number, string>
  /** Each outfit's character, by her English name, by outfit id: how a universe look finds her (D25). */
  characters: ReadonlyMap<number, string>
  art: ArtIndex | null
}

export type MasterState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; version: string; view: MasterView }
  | { status: 'error'; message: string; offline: boolean }

let state: MasterState = { status: 'idle' }
const listeners = new Set<() => void>()
function set(next: MasterState): void {
  state = next
  for (const listener of listeners) listener()
}

export function loadMaster(): void {
  if (state.status === 'loading' || state.status === 'ready') return
  set({ status: 'loading' })
  void (async () => {
    try {
      const [client, manifest] = await Promise.all([CONTENT.release(), CONTENT.manifest()])
      const [characters, outfits, art] = await Promise.all([client.set(manifest, 'characters'), client.set(manifest, 'outfits'), client.art(manifest).catch(() => null)])
      const byCharacter = new Map(characters.map((c) => [c.id, c]))
      const view: MasterView = {
        version: manifest.version,
        info: new Map(outfits.map((o) => [o.id, { stats: o.stats.star5, strategy: o.aptitudes.strategy }])),
        names: new Map(outfits.map((o) => [o.id, outfitRowBase(o, byCharacter.get(o.characterId)).name])),
        characters: new Map(outfits.flatMap((o) => { const en = byCharacter.get(o.characterId)?.name.en; return en ? [[o.id, en] as const] : [] })),
        art,
      }
      setNameSource((id) => view.names.get(id))
      set({ status: 'ready', version: manifest.version, view })
    } catch (err) {
      set({ status: 'error', message: err instanceof Error ? err.message : String(err), offline: typeof navigator !== 'undefined' && navigator.onLine === false })
    }
  })()
}

/** Try again after an error. */
export function retryMaster(): void {
  if (state.status === 'error') { CONTENT.refresh(); set({ status: 'idle' }) }
  loadMaster()
}

export function useMaster(): MasterState {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, () => state, () => state)
}
