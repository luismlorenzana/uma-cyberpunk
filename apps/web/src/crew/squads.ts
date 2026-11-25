// Squads through the save (CY18): moving an Uma between squads (or out of them), a new squad, renaming and the leader.
// A squad away on an operation keeps its members until it's back. Every change goes through the domain's rules.
import { canTakeOrdinaryAssignment, leaveSquad, newSquad, setSquad, SQUAD_TUNING, squadOf, squadProblem, type Save, type Squad } from '@cyber/domain'

const awaySquad = (save: Save, id: string | undefined): boolean => !!id && save.operations.some((r) => r.squad === id)

/** Why an Uma can't move to that squad now, or null. */
export function moveProblem(save: Save, outfit: number, to: string | 'new' | null): string | null {
  if (to !== null && !canTakeOrdinaryAssignment(save.crew.find(member => member.outfit === outfit))) return 'Unavailable for squads'
  const from = squadOf(save.squads, outfit)
  if (awaySquad(save, from?.id)) return `${from!.name} is away on an operation`
  if (to === null || to === from?.id) return null
  if (to === 'new') return save.squads.filter((s) => s.id !== from?.id || s.members.length > 1).length >= SQUAD_TUNING.maxSquads ? `${SQUAD_TUNING.maxSquads} squads at most` : null
  const target = save.squads.find((s) => s.id === to)
  if (!target) return 'No such squad'
  if (awaySquad(save, to)) return `${target.name} is away on an operation`
  return target.members.length >= SQUAD_TUNING.maxMembers ? `${target.name} is full` : null
}

/** Moves an Uma to a squad, to a new squad she leads, or out of every squad. */
export function moveToSquad(save: Save, outfit: number, to: string | 'new' | null): Save {
  if (moveProblem(save, outfit, to)) return save
  const out = leaveSquad(save.squads, outfit)
  if (to === null) return { ...save, squads: out }
  if (to === 'new') return { ...save, squads: [...out, newSquad(out, outfit)] }
  return { ...save, squads: out.map((s) => (s.id === to ? { ...s, members: [...s.members, outfit] } : s)) }
}

/** Renames a squad (1–24 characters) or makes a member its leader. */
export function editSquad(save: Save, id: string, change: Partial<Pick<Squad, 'name' | 'leader' | 'banner'>>): Save {
  const s = save.squads.find((x) => x.id === id)
  if (!s) return save
  const next = { ...s, ...change, name: (change.name ?? s.name).trim() }
  return squadProblem(save.squads, next) ? save : { ...save, squads: setSquad(save.squads, next) }
}
