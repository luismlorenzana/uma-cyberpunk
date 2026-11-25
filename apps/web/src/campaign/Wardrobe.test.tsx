import { newSave, parseCampaignBook, STAND_IN_FILES } from '@cyber/domain'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { Wardrobe } from './Wardrobe'
import { RecruitmentPanel } from './RecruitmentPanel'

const book = (visibleLooks?: string[]) => parseCampaignBook({ ...STAND_IN_FILES, 'campaign.json': {
  schemaVersion: 1, draft: true, opening: 'opening', quests: [{ id: 'opening', title: 'Opening', scene: 'sw1-ch1-s1' }],
  assets: [{ id: 'native', file: 'native.png' }, { id: 'portrait', file: 'portrait.png' }], art: [],
  wardrobe: { members: [{ speaker: 'stand-in-1', default: 'watch-suit', after: 'sw1-ch1-s2', requiresFlag: 'commander-released',
    ...(visibleLooks ? { visibleLooks } : {}), looks: {
    'watch-suit': { asset: 'native', portrait: 'portrait', label: 'Command Suit' },
    'quiet-hours': { asset: 'native', label: 'Quiet Hours' },
  } }], scenes: [], crops: [] },
} })

it('shows custom approved outfit names without inventing six crew roles or additional expression states', () => {
  const html = renderToStaticMarkup(<Wardrobe book={book()} assets={new Map()} speaker="stand-in-1" back={() => {}} />)
  expect(html).toContain('Command Suit')
  expect(html).toContain('Quiet Hours')
  expect(html).not.toContain('Ship Casual')
  expect(html).not.toContain('flustered')
  expect(html).toContain('min-h-11')
})

it('only browses approved wardrobe looks and starts on the first visible look when the default is scene-only', () => {
  const html = renderToStaticMarkup(<Wardrobe book={book(['quiet-hours'])} assets={new Map()} speaker="stand-in-1" back={() => {}} />)
  expect(html).toContain('Quiet Hours')
  expect(html).toContain('data-wardrobe-role="quiet-hours"')
  expect(html).not.toContain('Command Suit')
  expect(() => book(['unknown'])).toThrow(/visible look must be registered/)
})

it('reveals an ally wardrobe only after its existing campaign scene, without mutating progress', () => {
  const save = newSave('test', '2026-11-21T00:00:00Z'), campaign = book()
  const before = structuredClone(save)
  const props = { book: campaign, assets: new Map(), recruits: [], open: () => {} }
  expect(renderToStaticMarkup(<RecruitmentPanel {...props} save={save} />)).not.toContain('Ally wardrobes')
  const seen = { ...save, story: { ...save.story, seen: ['sw1-ch1-s2'] } }
  expect(renderToStaticMarkup(<RecruitmentPanel {...props} save={seen} />)).not.toContain('Ally wardrobes')
  const released = { ...seen, story: { ...seen.story, flags: ['commander-released'] } }
  expect(renderToStaticMarkup(<RecruitmentPanel {...props} save={released} />)).toContain('Ally wardrobes')
  expect(save).toEqual(before)
})
