import { newSave, touched } from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { reconcile } from './reconcile'

const T0 = '2026-11-08T12:00:00.000Z'
const T1 = '2026-11-08T12:05:00.000Z'
const T2 = '2026-11-08T12:10:00.000Z'
const base = newSave('u', T0)

describe('one sync round (uma-rpg D32)', () => {
  it('does nothing with nothing anywhere', () => expect(reconcile({ revision: 0, save: null, dirty: false }, { revision: 0, save: null })).toEqual({ kind: 'none' }))

  it("pushes this device's save to an empty server", () => {
    expect(reconcile({ revision: 0, save: base, dirty: true }, { revision: 0, save: null })).toEqual({ kind: 'push', baseRevision: 0, save: base })
  })

  it("adopts the server's on a device with none", () => {
    expect(reconcile({ revision: 0, save: null, dirty: false }, { revision: 3, save: base })).toEqual({ kind: 'adopt', envelope: { revision: 3, save: base }, replacesUnsynced: false })
  })

  it('adopts a newer server revision when this device is clean', () => {
    expect(reconcile({ revision: 2, save: base, dirty: false }, { revision: 3, save: touched(base, T1) })).toMatchObject({ kind: 'adopt', replacesUnsynced: false })
  })

  it('does nothing when clean and current', () => {
    expect(reconcile({ revision: 3, save: base, dirty: false }, { revision: 3, save: base })).toEqual({ kind: 'none' })
  })

  it('pushes changes made on top of the stored revision', () => {
    const mine = touched(base, T1)
    expect(reconcile({ revision: 3, save: mine, dirty: true }, { revision: 3, save: base })).toEqual({ kind: 'push', baseRevision: 3, save: mine })
  })

  it('pushes over a server that moved on when this device changed last', () => {
    const mine = touched(base, T2)
    expect(reconcile({ revision: 3, save: mine, dirty: true }, { revision: 4, save: touched(base, T1) })).toEqual({ kind: 'push', baseRevision: 4, save: mine })
  })

  it("adopts a server changed last, keeping this device's changes as a safety copy", () => {
    expect(reconcile({ revision: 3, save: touched(base, T1), dirty: true }, { revision: 4, save: touched(base, T2) })).toMatchObject({ kind: 'adopt', replacesUnsynced: true })
  })

  it("never lets an account started offline replace the server's, even when it's newer (D11)", () => {
    const offline = newSave('u', T2)
    expect(reconcile({ revision: 0, save: offline, dirty: true }, { revision: 5, save: base })).toEqual({ kind: 'adopt', envelope: { revision: 5, save: base }, replacesUnsynced: true })
  })
})
