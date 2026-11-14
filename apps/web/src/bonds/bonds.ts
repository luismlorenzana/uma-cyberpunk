// Bonds between the screens and the save (CY13, TC56): the story's gates, the catch-up, rapport from a battle's cues and
// from replies, a bond scene's effects, the scene that's ready. Pure, tested headless; the rank rules are the domain's.
import {
  addRapport, BOND_TUNING, catchUpFactor, choosePath, finishedChapters, keyMet, readyScene, seeBondScene, settleBond, shipCapabilities, standingNow, type BondFile, type CrewMember, type Save,
  type StoryPack,
} from '@cyber/domain'
import type { BondEffect } from '../story/runner'

/** Whether bond rank `rank` is open: no key named for it, or the key the story names is met (any kind: a chapter, a
 * mission, a File, the ship's capability or a faction's standing). */
export const gateOpenFor = (pack: StoryPack | null, save: Save) => (rank: number): boolean => {
  const key = pack?.casting.bondGates?.[String(rank)]
  return !key || !pack || keyMet(key, save.story, { missions: save.worlds.missions, chapters: finishedChapters(pack, save.story), capabilities: shipCapabilities(save.ship), standing: standingNow(pack, save) })
}

const withMember = (save: Save, outfit: number, change: (m: CrewMember) => CrewMember): Save =>
  ({ ...save, crew: save.crew.map((m) => (m.outfit === outfit ? change(m) : m)) })

/** Rapport for an Uma aboard, doubled below the crew's median rank, landing any rank whose gate is open. */
export function giveRapport(save: Save, pack: StoryPack | null, outfit: number, amount: number): Save {
  const ranks = save.crew.map((m) => m.bond.rank)
  const open = gateOpenFor(pack, save)
  return withMember(save, outfit, (m) => ({ ...m, bond: addRapport(m.bond, amount * catchUpFactor(m.bond.rank, ranks), open) }))
}

/** Every bond with a gate opened since, landed. The same save back when nothing changed. */
export function settleBonds(save: Save, pack: StoryPack | null): Save {
  const open = gateOpenFor(pack, save)
  let changed = false
  const crew = save.crew.map((m) => { const bond = settleBond(m.bond, open); if (bond.rank !== m.bond.rank) changed = true; return bond.rank === m.bond.rank ? m : { ...m, bond } })
  return changed ? { ...save, crew } : save
}

/** After a battle: its rapport (from `battleRapport`, in the battle's own chunk) to the Umas aboard who fought, and their
 * messages in the inbox. */
export function afterBattleBonds(save: Save, pack: StoryPack | null, gains: ReadonlyMap<number, number> | null): Save {
  if (!gains) return save
  const aboard = new Set(save.crew.map((m) => m.outfit))
  let next = save
  for (const [outfit, amount] of gains) if (aboard.has(outfit)) next = giveRapport(next, pack, outfit, amount)
  return { ...next, inbox: [...gains.keys()].filter((o) => aboard.has(o)) }
}

/** A reply to her message: rapport once, and the message read. */
export function replyTo(save: Save, pack: StoryPack | null, outfit: number): Save {
  if (!save.inbox.includes(outfit)) return save
  return { ...giveRapport(save, pack, outfit, BOND_TUNING.reply), inbox: save.inbox.filter((o) => o !== outfit) }
}

/** What a bond scene changes as it plays. */
export function applyBondEffect(save: Save, pack: StoryPack | null, outfit: number, effect: BondEffect): Save {
  if (effect.kind === 'rapport') return giveRapport(save, pack, outfit, effect.amount)
  return withMember(save, outfit, (m) => ({ ...m, bond: choosePath(m.bond, effect.path) }))
}

export const bondSceneDone = (save: Save, outfit: number, rank: number): Save => withMember(save, outfit, (m) => ({ ...m, bond: seeBondScene(m.bond, rank) }))

/** Her bond file, if the story has one. */
export const bondFileOf = (pack: StoryPack | null, outfit: number): BondFile | undefined => pack?.bonds[String(outfit)]

/** The rank of her bond scene ready to play, or null. */
export function readyBondScene(pack: StoryPack | null, member: CrewMember): number | null {
  const file = bondFileOf(pack, member.outfit)
  return file ? readyScene(member.bond, file.scenes.map((s) => s.rank)) : null
}
