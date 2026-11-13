// The board's design and three of CY7's five checks, which run without a canvas (the other two run on the page).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseMap, type BattleMap } from '@cyber/battle'
import { cameraOffset, hitQuad, project, rayAt, roomGeometry, standInKitAtlas, tileQuad, type View } from '@luismlorenzana/uma-stage'
import { describe, expect, it } from 'vitest'
import { levelOf, toRoomDesign } from './design'

const map = (id: string): BattleMap => parseMap(JSON.parse(readFileSync(resolve(__dirname, `../../../../scenarios/maps/${id}.json`), 'utf8')))
const KIT = standInKitAtlas('biome')
/** A phone held sideways at DPR 3: 844 × 390 CSS px. */
const VIEW = (m: BattleMap): View => ({ look: { x: m.width / 2, y: 0, z: m.depth / 2 }, width: 844, height: 390, ratio: 3 })

describe('the board design', () => {
  it('passes heights as they are and turns solid tiles into walls', () => {
    const d = toRoomDesign({ heights: ['0123'], tiles: ['.#=c'] })
    expect(d).toEqual({ cells: ['.#..'], heights: ['0123'], spots: [] })
  })
})

describe('check 1: a level-3 tile builds', () => {
  it('builds risers up to level 3 from a design made directly', () => {
    const geo = roomGeometry(toRoomDesign({ heights: ['0000', '0310', '0000'], tiles: ['....', '....', '....'] }), KIT)
    const top = Math.max(...geo.faces.flatMap((f) => f.corners.map((c) => c.y)))
    expect(top).toBe(3)
    const heights = map('heights-14')
    const built = roomGeometry(toRoomDesign(heights), KIT)
    expect(Math.max(...built.faces.flatMap((f) => f.corners.map((c) => c.y)))).toBe(3)
  })
})

/** Which tile top a screen point picks: the nearest hit among every tile's top quad. */
function pickTile(m: BattleMap, view: View, x: number, y: number): string | null {
  const ray = rayAt(view, x, y)
  let best: { key: string; t: number } | null = null
  for (let z = 0; z < m.depth; z++) for (let tx = 0; tx < m.width; tx++) {
    const t = hitQuad(ray, tileQuad(tx, z, levelOf(m, tx, z)))
    if (t !== null && (!best || t < best.t)) best = { key: `${tx},${z}`, t }
  }
  return best?.key ?? null
}

describe('check 2: picking with heights', () => {
  it('picks every visible tile top back to itself on a 14 × 14 map with heights, and a tile is about 24 pt deep at DPR 3', () => {
    const m = map('heights-14'), view = VIEW(m)
    const geo = roomGeometry(toRoomDesign(m), KIT)
    let onScreen = 0, visible = 0, back = 0
    for (let z = 0; z < m.depth; z++) for (let x = 0; x < m.width; x++) {
      const y = levelOf(m, x, z)
      const p = project(view, { x: x + 0.5, y, z: z + 0.5 })
      if (p.x < 0 || p.y < 0 || p.x > view.width || p.y > view.height) continue
      onScreen++
      // Visible: no terrain face in front of the top's middle.
      const ray = rayAt(view, p.x, p.y), own = hitQuad(ray, tileQuad(x, z, y)) ?? Infinity
      if (geo.faces.some((f) => { const t = hitQuad(ray, f.corners as never); return t !== null && t < own - 1e-4 })) continue
      visible++
      if (pickTile(m, view, p.x, p.y) === `${x},${z}`) back++
    }
    console.log(`Picking: ${back} of ${visible} visible tile tops pick back (${onScreen} on screen)`)
    expect(back).toBe(visible)
    const near = project(view, { x: 7, y: 0, z: 7 }), far = project(view, { x: 7, y: 0, z: 6 })
    const depthPt = near.y - far.y
    expect(depthPt).toBeGreaterThan(20)
    expect(depthPt).toBeLessThan(28)
    void cameraOffset
  })
})

describe('check 5: what heights hide', () => {
  it('reports the share of tile tops more than half covered by nearer terrain', () => {
    const report: Record<string, number> = {}
    for (const id of ['flat-14', 'heights-14', 'underlevels', 'yard']) {
      const m = map(id), view = VIEW(m)
      const geo = roomGeometry(toRoomDesign(m), KIT)
      let tiles = 0, covered = 0
      for (let z = 0; z < m.depth; z++) for (let x = 0; x < m.width; x++) {
        if (m.tiles[z]![x] === '#') continue
        tiles++
        const y = levelOf(m, x, z)
        let hidden = 0, samples = 0
        for (const [sx, sz] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75], [0.5, 0.5]] as const) {
          samples++
          const p = project(view, { x: x + sx, y, z: z + sz })
          const ray = rayAt(view, p.x, p.y)
          const own = hitQuad(ray, tileQuad(x, z, y)) ?? Infinity
          const nearer = geo.faces.some((f) => {
            const t = hitQuad(ray, f.corners as never)
            return t !== null && t < own - 1e-4
          })
          if (nearer) hidden++
        }
        if (hidden / samples > 0.5) covered++
      }
      report[id] = Math.round((covered / tiles) * 1000) / 10
    }
    console.log(`Tile tops more than half hidden: ${JSON.stringify(report)}`)
    expect(report['flat-14']).toBe(0)
    expect(report['heights-14']!).toBeLessThan(15)
  })
})
