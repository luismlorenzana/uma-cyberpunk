// The crew view and deploy, headless (CY11): roles from the tag, the running style or nothing; a rig built in the Hangar is
// the loadout the battle gets; the bench's roles go with it.
import { bestRig, loadoutOf, newMember, newSave, parsePack, STAND_IN_FILES, type StoryPack } from '@cyber/domain'
import { startBattle } from '@cyber/battle'
import { describe, expect, it } from 'vitest'
import { missionInput } from '../mission/battleInput'
import { swapped } from './Hangar'
import { infoFrom, memberView, updateMember } from './view'

const pack = parsePack(STAND_IN_FILES).pack as StoryPack
const name = (o: number) => `Uma ${o}`
const info = infoFrom(null)

describe('the crew view', () => {
  it('takes the story tag, then the running style, else Striker on band 3 with no Stride', () => {
    const a = memberView(newMember(9000001), pack, info, name)
    expect([a.role, a.roleFrom, a.stride, a.unknown]).toEqual(['striker', 'tag', 'break', false])
    const c = memberView(newMember(9000003), pack, info, name)
    expect([c.role, c.roleFrom, c.bands.power]).toEqual(['vanguard', 'style', 4])
    const x = memberView(newMember(1234), pack, info, name)
    expect([x.role, x.roleFrom, x.stride, x.unknown, x.bands.speed]).toEqual(['striker', 'none', null, true, 3])
  })
  it('wears "best for her role" until the player builds a rig, then hers', () => {
    const c = memberView(newMember(9000003), pack, info, name)
    expect(c.auto).toBe(true)
    expect(c.rig).toEqual(bestRig('vanguard', c.bands))
    const built = swapped(c.rig, 'rightHand', 'hand-greatblade')
    expect(built.leftHand).toBeNull()
    const save = updateMember({ ...newSave('u', '2026-11-12T00:00:00.000Z'), crew: [newMember(9000003)] }, 9000003, (m) => ({ ...m, rig: built }))
    const after = memberView(save.crew[0]!, pack, info, name)
    expect([after.auto, after.rig.rightHand]).toEqual([false, 'hand-greatblade'])
  })
})

describe('deploy', () => {
  it('gives the battle the rig built in the Hangar, her bands and Stride, and the bench its roles', () => {
    const v = memberView({ ...newMember(9000003), rig: swapped(bestRig('vanguard', { speed: 2, stamina: 3, power: 4, guts: 2, wit: 1 }), 'coat', 'coat-f') }, pack, info, name)
    const input = missionInput('sandbox-muster', [{ outfit: v.outfit, label: v.name, bands: v.bands, loadout: loadoutOf(v.rig), stride: v.stride }], ['medic'], 'm:1')
    const unit = input.units.find((u) => u.side === 'squad')!
    expect(unit.loadout).toEqual(loadoutOf(v.rig))
    expect(unit.loadout.coat).toBe('F')
    expect([unit.bands, unit.stride, unit.ref, unit.label]).toEqual([v.bands, 'draft', { kind: 'uma', id: '9000003' }, 'Uma 9000003'])
    expect(input.bench).toEqual(['medic'])
    expect(() => startBattle(input)).not.toThrow()
  })
})
