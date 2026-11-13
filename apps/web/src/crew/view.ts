// The crew as the screens see it (CY11): each member's record joined with what the game knows of her (master data's 5★
// stats and running style, else the stand-in table, else nothing), her role (set aboard, else the story's tag, else her
// running style), her rig (built in the Hangar, else "best for her role") and its numbers. Pure, tested headless.
import {
  bandsOf, bestStyle, levelOf, resting, rigOf, rigStats, roleOf, STAND_IN_BANDS, STAND_IN_OUTFITS, STYLE_STRIDE, type CrewMember, type OutfitInfo, type Rig,
  type RigStats, type Save, type StoryPack,
} from '@cyber/domain'
import type { Bands, Role, Stride } from '@cyber/battle'
import type { Strategy } from '@luismlorenzana/uma-data'

export interface CrewView {
  member: CrewMember
  outfit: number
  name: string
  /** True when neither master data nor the stand-in table knows her: a stand-in card, band 3 everywhere, no Stride. */
  unknown: boolean
  bands: Bands
  style: Strategy | null
  stride: Stride | null
  role: Role
  /** Where her role comes from: set aboard, the story's tag, or her running style. */
  roleFrom: 'set' | 'tag' | 'style' | 'none'
  rig: Rig
  /** The rig is "best for her role", not one the player built. */
  auto: boolean
  stats: RigStats
  level: number
  resting: boolean
}

export type InfoOf = (outfit: number) => OutfitInfo | null
export const infoFrom = (master: ReadonlyMap<number, OutfitInfo> | null): InfoOf => (outfit) => master?.get(outfit) ?? STAND_IN_OUTFITS[outfit] ?? null

export function memberView(member: CrewMember, pack: StoryPack | null, infoOf: InfoOf, nameOf: (outfit: number) => string): CrewView {
  const info = infoOf(member.outfit)
  const bands = info ? bandsOf(info.stats) : STAND_IN_BANDS
  const style = info ? bestStyle(info.strategy) : null
  const tag = pack?.casting.roles?.[String(member.outfit)]
  const role = roleOf(member, tag, info)
  const rig = rigOf(member, role, bands)
  return {
    member, outfit: member.outfit, name: nameOf(member.outfit), unknown: !info, bands, style, stride: style ? STYLE_STRIDE[style] : null,
    role, roleFrom: member.role ? 'set' : tag ? 'tag' : info ? 'style' : 'none', rig, auto: !member.rig, stats: rigStats(rig, bands),
    level: levelOf(member.xp), resting: resting(member),
  }
}

export const crewViews = (save: Save, pack: StoryPack | null, infoOf: InfoOf, nameOf: (outfit: number) => string): CrewView[] =>
  save.crew.map((m) => memberView(m, pack, infoOf, nameOf))

/** A crew member's change, by outfit. */
export const updateMember = (save: Save, outfit: number, change: (m: CrewMember) => CrewMember): Save =>
  ({ ...save, crew: save.crew.map((m) => (m.outfit === outfit ? change(m) : m)) })
