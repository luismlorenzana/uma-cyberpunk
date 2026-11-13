// The package stays pure: no unseeded randomness, no clock, no dependencies (CY4). The patterns are built from pieces, so
// `grep -r` for them over the package finds nothing.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = join(__dirname)
const sources = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

describe('purity', () => {
  it('never rolls unseeded or reads the clock', () => {
    for (const file of sources) {
      const text = readFileSync(join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      expect(text, file).not.toMatch(new RegExp([['Math', 'random'], ['Date', 'now'], ['performance', 'now']].map((p) => p.join('\\.')).join('|') + '|new Date'))
    }
  })
  it('has no dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(dir, '..', 'package.json'), 'utf8')) as { dependencies?: object }
    expect(pkg.dependencies ?? {}).toEqual({})
  })
})
