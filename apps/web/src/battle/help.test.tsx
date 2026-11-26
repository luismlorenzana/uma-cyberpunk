import { renderToStaticMarkup } from 'react-dom/server'
import { COMMAND_ORDERS } from '@cyber/domain'
import { expect, it } from 'vitest'
import { BattleHelp } from './BattleHelp'
import { actionHelpTopic, battleHelp, objectiveTopics, orderTopics, tileTopics, unitHelpTopics } from './help'
import type { UnitState } from '@cyber/battle'

it('provides labeled, version-aware targets for supported objectives and bridge orders', () => {
  for (const topic of [...Object.values(objectiveTopics), ...COMMAND_ORDERS.map(order => orderTopics[order]), ...Object.values(tileTopics)]) {
    const markup = renderToStaticMarkup(<BattleHelp topic={topic} />)
    expect(markup).toContain(`aria-label="About ${battleHelp[topic][0]}"`)
    expect(markup).toContain('min-h-11 min-w-11')
  }
  expect(renderToStaticMarkup(<BattleHelp topic="suppress" version={4} />)).toBe('')
  expect(renderToStaticMarkup(<BattleHelp topic="suppress" version={7} />)).toContain('About Suppress')
})

it('routes unit conditions and forecast actions to the correct help', () => {
  const unit = { status: 'down', reloading: true, pinned: true, suppressed: true, stunned: true,
    windup: { target: 'lead', with: 'right' }, holdHp: 3, signatureMark: { target: 'lead', tile: [1, 1], targetTurn: 2 } } as const
  expect(unitHelpTopics(unit as UnitState)).toEqual(['down', 'stunned', 'reloading', 'pinned', 'suppressed', 'windup', 'holdHp', 'signature'])
  expect(actionHelpTopic({ kind: 'attack', with: 'back', target: 'enemy', mode: 'suppress' })).toBe('suppress')
  expect(actionHelpTopic({ kind: 'hack', terminal: 'switch' })).toBe('hack')
})
