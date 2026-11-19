import type { CampaignComposition } from './campaign'
import { P } from './parse'

export function parseComposition(p: P, value: unknown, field: string, asset: (value: unknown, field: string) => string): CampaignComposition {
  const c = p.object(value, `${field}`, ['width', 'height', 'portraits', 'layers'])
  const width = p.int(c.width, `${field}.width`, 1, 8192), height = p.int(c.height, `${field}.height`, 1, 8192)
  if (c.portraits !== 'show' && c.portraits !== 'hide') p.fail(field, 'composition portraits must be show or hide')
  const layers = p.list(c.layers, `${field}.layers`, (value, field) => {
    const l = p.object(value, field, ['asset', 'x', 'y', 'width', 'height', 'opacity', 'fit'], ['asset', 'x', 'y', 'width', 'height'])
    const x = p.int(l.x, `${field}.x`, 0, width), y = p.int(l.y, `${field}.y`, 0, height)
    const w = p.int(l.width, `${field}.width`, 1, width), h = p.int(l.height, `${field}.height`, 1, height)
    if (x + w > width || y + h > height) p.fail(field, 'layer extends beyond the composition')
    const opacity = l.opacity === undefined ? 100 : p.int(l.opacity, `${field}.opacity`, 0, 100)
    if (l.fit !== undefined && l.fit !== 'contain' && l.fit !== 'cover') p.fail(field, 'layer fit must be contain or cover')
    return { asset: asset(l.asset, `${field}.asset`), x, y, width: w, height: h, opacity, fit: (l.fit ?? 'contain') as 'contain' | 'cover' }
  }, 12)
  return { width, height, portraits: c.portraits as 'show' | 'hide', layers }
}
