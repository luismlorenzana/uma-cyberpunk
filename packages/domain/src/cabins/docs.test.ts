// The manual's item list is the code's (CY14): docs/game/cabins.md holds it between `<!-- live:items -->` and
// `<!-- /live -->`, rendered here from the item table. `pnpm docs:update` rewrites the block; this test fails when stale.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DECOR_NAME, DECOR_STYLES, FURNITURE, GIFT_KINDS, GIFT_NAME, GIFTS, KEEPSAKES, LINE_SLOTS } from './items'

const DOC = join(__dirname, '../../../../docs/game/cabins.md')

export function itemsBlock(): string {
  const cell = (style: string, slot: string) => { const f = FURNITURE.find((x) => x.style === style && x.slot === slot)!; return `${f.name} (${f.comfort})` }
  return [
    `**${FURNITURE.length} pieces of furniture, ${KEEPSAKES.length} keepsakes and ${GIFTS.length} gifts:**`,
    '',
    '| Style | Bed | Desk | Wall | Floor | Light |',
    '|---|---|---|---|---|---|',
    ...DECOR_STYLES.map((s) => `| ${DECOR_NAME[s]} | ${LINE_SLOTS.map((slot) => cell(s, slot)).join(' | ')} |`),
    '',
    `**Keepsakes:** ${KEEPSAKES.map((k) => `${k.name} (${k.comfort})`).join(', ')}`,
    '',
    `**Gifts:** ${GIFT_KINDS.map((k) => `${GIFT_NAME[k]}: ${GIFTS.filter((g) => g.gift === k).map((g) => g.name).join(', ')}`).join(' · ')}`,
  ].join('\n')
}

const live = (doc: string, body: string) => doc.replace(/<!-- live:items -->[\s\S]*?<!-- \/live -->/, `<!-- live:items -->\n${body}\n<!-- /live -->`)

describe('the manual', () => {
  it('holds the current items', () => {
    const doc = readFileSync(DOC, 'utf8').replaceAll('\r\n', '\n')
    const current = live(doc, itemsBlock())
    if (process.env.UPDATE_DOCS === '1') writeFileSync(DOC, current)
    else expect(doc).toBe(current)
  })
})
