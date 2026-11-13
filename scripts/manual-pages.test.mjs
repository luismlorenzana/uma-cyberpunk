// The manual's desktop pages are current (CY4): each is what scripts/manual-pages.mjs renders from its Markdown.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { blocks, pages } from './manual-pages.mjs'

test('every manual page has its current desktop page', () => {
  for (const [path, html] of pages()) {
    assert.ok(existsSync(path), `${path} is missing: run node scripts/manual-pages.mjs`)
    assert.equal(readFileSync(path, 'utf8'), html, `${path} is stale: run node scripts/manual-pages.mjs`)
  }
})

test('renders the Markdown the manual uses', () => {
  const html = blocks(['## A `b` c', '', '- one **bold**', '  carried on', '  - nested', '- two [link](battle.md#x)', '', '| A | B |', '|---|---|', '| 1 | 2 |', '', '```mermaid', 'flowchart LR', '```'])
  assert.match(html, /<h2 id="a-b-c">A <code>b<\/code> c<\/h2>/)
  assert.match(html, /<li>one <b>bold<\/b> carried on<ul><li>nested<\/li><\/ul><\/li>/)
  assert.match(html, /<a href="battle.html#x">link<\/a>/)
  assert.match(html, /<th>A<\/th><th>B<\/th><\/tr><tr><td>1<\/td>/)
  assert.match(html, /<pre class="mermaid">flowchart LR<\/pre>/)
})
