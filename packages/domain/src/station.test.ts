import { expect, it } from 'vitest'
import { newSave, parseSave } from './save/save'
import {
  assignStationShift, bookStationAppointment, buildStationRoom, cancelStationAppointment, firstStation, rerouteStationPower, setStationPower, stationCapacity, stationDate, stationPower, stationRoom,
  tickStation,
} from './station'

it('saves station construction, powers finished rooms in order and advances the date once per watch', () => {
  const save = newSave('station', '2026-11-26T00:00:00.000Z')
  const state = { ...firstStation(), rooms: { 'habitat-b': 0, fabrication: 0, shipyard: 1 } } as const
  const yard = buildStationRoom({ ...state, rooms: { ...state.rooms }, off: [] }, save.wallet, 'habitat-a')
  expect(yard?.wallet.alloy).toBe(save.wallet.alloy - 18)
  const first = tickStation(yard!.station, new Set())
  expect(stationRoom(first.station, 'shipyard')).toBe('off')
  expect(stationCapacity(first.station)).toBe(180)
  const second = tickStation(first.station, new Set())
  expect(stationCapacity(second.station)).toBe(280)
  expect(second.station.absoluteWatch).toBe(2)
  expect(stationDate(second.station.absoluteWatch)).toEqual({ year:1, month:'Keel', day:1, phase:'Night', hour:'2200' })
  const reloaded = parseSave(JSON.parse(JSON.stringify({ ...save, station:second.station })))
  expect(reloaded.station).toEqual(second.station)
  expect(setStationPower(reloaded.station!, 'shipyard')).toBe(reloaded.station)
  expect(stationPower(setStationPower(setStationPower(reloaded.station!, 'fabrication'), 'shipyard'))).toEqual({ supply:4, used:3 })
  expect(stationDate(360)).toEqual({ year:2, month:'Keel', day:1, phase:'Duty', hour:'0600' })
})

it('applies a shift only on Duty and keeps manual assignments ahead of automatic cover', () => {
  const start = assignStationShift({ ...firstStation(), autoStaff:true, rooms:{ fabrication:0 } }, 'fabrication', 9000001)
  const first = tickStation(start, new Set([9000001, 9000002]))
  expect(first.station.report).toEqual({ at:0, workers:[9000002,9000001], alloy:2, data:1 })
  const second = tickStation(first.station, new Set([9000001, 9000002]))
  expect(second.station.report).toBe(first.station.report)
  expect(second.alloy).toBe(0)
})

it('restores distinct visit and care appointments and reschedules one without moving the other', () => {
  const save = newSave('station', '2026-11-26T00:00:00.000Z')
  const booked = bookStationAppointment(bookStationAppointment(firstStation(), { actor: 9000001 }), { quest:'care-review' })
  expect(booked.appointments).toEqual([{ quest:'care-review', at:1 }, { actor:9000001, at:2 }])
  const next = bookStationAppointment({ ...booked, absoluteWatch:4 }, { actor:9000001 })
  expect(next.appointments).toEqual([{ quest:'care-review', at:1 }, { actor:9000001, at:5 }])
  const reloaded = parseSave(JSON.parse(JSON.stringify({ ...save, station:next })))
  expect(reloaded.station).toEqual(next)
  expect(cancelStationAppointment(reloaded.station!, { quest:'care-review' }).appointments).toEqual([{ actor:9000001, at:5 }])
})

it('keeps station reserves and up to 250 permanent assignments in the saved state', () => {
  const save = newSave('station', '2026-11-26T00:00:00.000Z')
  const state = { ...firstStation(), rooms: { 'life-support': 0 }, autoStaff: true as const,
    lieutenantResidents: Array.from({ length: 150 }, (_, index) => `officer-${index + 1}`),
    preferredCabins: Object.fromEntries(Array.from({ length: 250 }, (_, index) => [`resident-${index + 1}`, index + 1])),
    reserves: { fuel: 3, provisions: 98 } }
  const staffed = tickStation(state, new Set([9000001, 9000002]))
  expect(staffed.station.reserves).toEqual({ fuel: 3, provisions: 99 })
  const saved = { ...save, station: staffed.station }
  expect(parseSave(JSON.parse(JSON.stringify(saved))).station).toEqual(staffed.station)
  expect(() => parseSave({ ...saved, station: { ...saved.station, preferredCabins: { first: 1, second: 1 } } })).toThrow(/distinct/)
})

it('conserves base deliveries through storage limits, relocation and reload, and protects reserved jump power', () => {
  const save = newSave('station', '2026-11-26T00:00:00.000Z')
  const station = { ...firstStation(), rooms: { 'jump-ring': 0, fabrication: 0, shipyard: 0 },
    off: ['shipyard' as const], move: { to: 'remote', at: 2 }, reserves: { fuel: 97, provisions: 6 },
    deliveries: [{ from: 'nearby', kind: 'fuel' as const, at: 1, amount: 4 }] }
  expect(setStationPower(station, 'jump-ring')).toBe(station)
  expect(rerouteStationPower(station, 'shipyard', 'jump-ring')).toBe(station)
  const next = tickStation(station, new Set()).station
  expect(next.reserves?.fuel).toBe(97)
  expect(next.deliveries?.[0]?.at).toBe(2)
  const relocated = tickStation(next, new Set()).station
  expect(relocated.anchor).toBe('remote')
  expect(relocated.reserves?.fuel).toBe(99)
  expect(relocated.deliveries?.[0]?.amount).toBe(2)
  const restored = parseSave(JSON.parse(JSON.stringify({ ...save, station: relocated }))).station!
  const serviced = tickStation({ ...restored, reserves: { fuel: 94, provisions: 6 } }, new Set()).station
  expect(serviced.reserves?.fuel).toBe(96)
  expect(serviced.deliveries).toEqual([])
})

it('queues two visits on one Night and preserves dawn scenes and contact history through reload', () => {
  const save = newSave('captain', '2026-11-26T00:00:00.000Z')
  const first = bookStationAppointment(firstStation(), { actor: 9000001 })
  const second = bookStationAppointment(first, { actor: 9000002 })
  const station = {
    ...bookStationAppointment(second, { actor: 9000003 }),
    absoluteWatch: 3,
    night: { day: 1, used: 2, mornings: [{ kind: 'morning' as const, companion: 9000002, scene: 'second-morning' }] },
    lastContact: { '9000001': 1, '9000002': 1 },
  }
  expect(station.appointments?.map(row => row.at)).toEqual([2, 2, 5])
  const morning = { kind: 'morning' as const, companion: 9000001, scene: 'first-morning' }
  const stored = { ...save, campaignDay: { day: 2, pending: morning }, station }
  expect(parseSave(JSON.parse(JSON.stringify(stored)))).toEqual(stored)
})
