// The battle screen's faces (D18): an Uma's chip on the timeline and her side of the cut-in show her art from master
// data; stand-ins and enemies keep their initials and cards.
import { startBattle, scenarioInput } from '@cyber/battle'
import { AlbumArtProvider, type AlbumArt } from '@luismlorenzana/uma-kit/album'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SCENARIOS } from '../mission/battleInput'
import { CutIn, Timeline, umaOf } from './parts'
import maps from '../../../../scenarios/maps/underlevels-14.json'

const ART: AlbumArt = { useUrl: (kind, id) => `blob:${kind}-${id}` }

describe('faces on the battle screen', () => {
  const s = SCENARIOS['sandbox-muster']!
  const input = scenarioInput({ ...s, input: { ...s.input, units: s.input.units.map((u) => (u.id === 'vanguard-a' ? { ...u, ref: { kind: 'uma' as const, id: '9000001' }, label: 'Lead A' } : u)) } }, maps as never, 1)
  const state = startBattle(input).state
  it('knows an Uma by her ref', () => {
    expect(umaOf(state, 'vanguard-a')).toBe('9000001')
    expect(umaOf(state, 'striker-a')).toBeNull()
  })
  it('shows her face on the timeline and her bust in the cut-in, initials and cards for the rest', () => {
    const html = renderToString(<AlbumArtProvider art={ART}>
      <Timeline state={state} ids={['vanguard-a', 'striker-a']} ghost={null} onInspect={() => {}} />
      <CutIn state={state} c={{ attacker: 'vanguard-a', target: state.units.find((u) => u.side === 'enemy')!.id, band: 'short', role: 'vanguard', speed: 'full', numbers: [], key: 1 }} />
    </AlbumArtProvider>)
    expect(html).toContain('blob:face-9000001')
    expect(html).toContain('blob:bust-9000001')
    expect(html).toContain('>SA<')
  })
})
