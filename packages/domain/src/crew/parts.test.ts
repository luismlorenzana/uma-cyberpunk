import { applyBattleAction, armed, attacksFrom, checkLoadout, strikeOf } from '@cyber/battle'
import { expect, it } from 'vitest'
import { unit } from '../../../battle/src/fixtures'
import { edit, setup, unitOf } from '../../../battle/src/test-kit'
import { issuedCampaignRig } from '../campaign-gear'
import { loadoutOf, PARTS_BY_ID } from './parts'

it('materializes every catalog part into a legal version-4 rig', () => {
  for (const part of PARTS_BY_ID.values()) {
    const rig = issuedCampaignRig()
    if (part.slot === 'arm') rig.leftArm = rig.rightArm = part.id
    else if (part.slot === 'hand') rig.rightHand = part.id
    else rig[part.slot] = part.id
    const actor = unit('actor', 'squad', 0, { bands: { speed: 3, stamina: 3, power: 5, guts: 3, wit: 3 }, loadout: loadoutOf(rig) })
    expect(() => checkLoadout(actor, part.id, 4), part.id).not.toThrow()
  }
})

it('fires the catalog Deck cannon at 1–3 tiles with impact damage and three limited shots', () => {
  for (const distance of [1, 3, 4]) {
    const state = setup([{ id: 'actor', at: [0, 1], opts: { loadout: loadoutOf(issuedCampaignRig('hand-rifle', 'back-deck-cannon')) } }],
      [{ id: 'target', at: [distance, 1] }], { version: 4, active: 'actor' })
    const preview = strikeOf(state, 'actor', 'back', 'target', [0, 1])
    const legal = attacksFrom(state, 'actor', [0, 1]).some(action => action.kind === 'attack' && action.with === 'back' && action.target === 'target')
    const fired = applyBattleAction(state, { kind: 'turn', unit: 'actor', act: { kind: 'attack', with: 'back', target: 'target' }, face: 'E' })
    if (distance === 4) {
      expect(legal).toBe(false)
      expect(fired.error).not.toBeNull()
      expect(fired.state).toEqual(state)
      continue
    }
    expect(legal).toBe(true)
    expect(preview?.weapon).toMatchObject({ band: 'short', type: 'I', power: 12, accuracy: 80, hits: 1, range: [1, 3] })
    expect(unitOf(state, 'actor').ammo).toBe(3)
    expect(fired.error).toBeNull()
    expect(unitOf(fired.state, 'actor').ammo).toBe(2)
    const empty = edit(fired.state, 'actor', u => { u.ammo = 0 })
    expect(armed(state.input.units[0]!, unitOf(empty, 'actor'), 'back')).toBeNull()
  }
})
