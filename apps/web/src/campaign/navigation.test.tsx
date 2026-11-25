
import { newSave, parseCampaignBook, STAND_IN_FILES, type CampaignQuest } from '@cyber/domain'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { describeCampaignQuest, indexCampaignNavigation } from './navigation'
import OperationsScreen from './OperationsScreen'

function campaign() {
  return parseCampaignBook({ ...STAND_IN_FILES, 'campaign.json': {
    schemaVersion: 1, draft: true, opening: 'opening',
    quests: [{ id: 'opening', title: 'First Watch', scene: 'sw1-ch1-s1' },
      { id: 'next', title: 'Second Watch', scene: 'sw1-ch1-s3', after: 'opening' }],
    art: [], assets: [],
  } })
}

it('lists the actual missing chapter and checks availability again after it is completed', () => {
  const book = campaign(), save = newSave('review', '2026-11-25T12:00:00Z'), index = indexCampaignNavigation(book)
  const next = index.quests.get('next')!
  expect(describeCampaignQuest(next, book, save, undefined, new Set(), index)).toMatchObject({
    ready: false, reason: 'Finish First Watch',
  })
  const opened = { ...save, story: { ...save.story, seen: ['sw1-ch1-s1'] } }
  expect(describeCampaignQuest(next, book, opened, undefined, new Set(['opening']), index).ready).toBe(true)
  const pending: CampaignQuest = { ...next, port: 'away-port' }
  const away = describeCampaignQuest(pending, book, opened, 'current-port', new Set(['opening']), index)
  expect(away.ready).toBe(false)
})

it('keeps current and completed quests distinct when browsing the Operations menu', () => {
  const book = campaign(), blank = newSave('review', '2026-11-25T12:00:00Z')
  const save = { ...blank, story: { ...blank.story, seen: ['sw1-ch1-s1'] } }
  const common = { book, save, complete: new Set(['opening']), navigation: indexCampaignNavigation(book), open: () => {},
    travel: () => {}, onBrowse: () => {} }
  const ready = renderToStaticMarkup(<OperationsScreen {...common}
    browse={{ type: 'All', act: 'All acts', state: 'Ready', search: '', page: 0 }} />)
  expect(ready).toContain('Second Watch')
  expect(ready).not.toContain('First Watch')
  const cleared = renderToStaticMarkup(<OperationsScreen {...common}
    browse={{ type: 'Story', act: 'All acts', state: 'Completed', search: 'first', page: 0 }} />)
  expect(cleared).toContain('First Watch')
  expect(cleared).not.toContain('Second Watch')
})
