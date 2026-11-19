import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { parsePack, STAND_IN_FILES } from '@cyber/domain'
import { ScenePlayer, type ScenePresentation } from './ScenePlayer'

describe('scene composition rendering', () => {
  it('keeps layer coordinates in their native contained canvas and preserves the ordinary backdrop', () => {
    const { pack } = parsePack(STAND_IN_FILES)
    if (!pack) throw new Error('The stand-in story must parse')
    const presentation: ScenePresentation = { backdrop: 'plate.png', portraits: [], composition: {
      width: 1844, height: 853, portraits: 'show', layers: [{ asset: 'officer-seated', url: 'seated.png',
        x: 400, y: 10, width: 600, height: 800, opacity: 75, fit: 'contain' }] } }
    const html = renderToStaticMarkup(<ScenePlayer pack={pack} scene={{ id: 'layer-review', place: 'cabin', steps: [] }}
      squad={[]} onEffect={() => {}} onBattle={async () => {}} onDone={() => {}} presentation={presentation} />)
    expect(html).toContain('data-scene-backdrop')
    expect(html).toContain('viewBox="0 0 1844 853"')
    expect(html).toContain('preserveAspectRatio="xMidYMid meet"')
    expect(html).toContain('x="400" y="10" width="600" height="800" opacity="0.75"')
    expect(html).toContain('data-scene-layer="officer-seated"')
  })
})
