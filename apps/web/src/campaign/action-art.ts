import { PARTS_BY_ID, type GroundEncounter } from '@cyber/domain'
import type { BattleInput } from '@cyber/battle'
import type { LoadedCampaign } from './load'

export function signatureSplashFiles(loaded: LoadedCampaign, input: BattleInput, encounter?: GroundEncounter) {
  const files = new Map((encounter?.signatureSplashes ?? []).flatMap(row => {
    const asset = loaded.assets.get(row.asset)
    return asset ? [[row.unit + ':' + row.signature, asset] as const] : []
  }))
  for (const unit of input.units) {
    if (!unit.ref) continue
    const speaker = unit.ref.kind === 'uma' ? Number(unit.ref.id) : unit.ref.kind === 'heroine' ? unit.ref.id : undefined
    if (speaker === undefined) continue
    const mount = unit.signature?.mount ?? 'right'
    if (mount === 'back') continue
    const slot = mount === 'left' ? 'leftHand' : 'rightHand'
    const equipped = unit.loadout[slot]
    if (!equipped || equipped.kind !== 'weapon') continue
    const look = loaded.book.wardrobe?.members.find(row => row.speaker === speaker)
    const splash = look?.signatureSplashes?.find(row => {
      if (row.side !== unit.side) return false
      if (unit.frozenRig) return unit.frozenRig[slot] === row.part
      const part = PARTS_BY_ID.get(row.part)
      if (part?.slot !== 'hand' || part.item.kind !== 'weapon') return false
      const native = part.item
      return equipped.band === native.band && equipped.type === native.type && equipped.hits === native.hits
        && equipped.range[0] === native.range[0] && equipped.range[1] === native.range[1] && equipped.twoHanded === native.twoHanded
    })
    const asset = splash && loaded.assets.get(splash.asset)
    if (!asset || !splash) continue
    if (unit.signature) {
      const key = unit.id + ':' + unit.signature.id
      if (!files.has(key)) files.set(key, asset)
    }
    if (unit.specialty?.kind === 'laser' && splash.part === 'hand-rifle') files.set(`${unit.id}:thermal:${mount}`, asset)
  }
  return [...files]
}
