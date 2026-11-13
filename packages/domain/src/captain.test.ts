import { describe, expect, it } from 'vitest'
import { captainName, fillCaptain } from './captain'

describe('the captain (TC55)', () => {
  const line = "{Captain}? {They} made it. Tell {them} {their} cabin is ready, and the choice is {theirs}. {They're} late."
  it('fills the name and each pronoun set, capitals kept', () => {
    expect(fillCaptain(line, { name: 'Rin', pronouns: 'they' })).toBe("Rin? They made it. Tell them their cabin is ready, and the choice is theirs. They're late.")
    expect(fillCaptain(line, { name: 'Rin', pronouns: 'she' })).toBe("Rin? She made it. Tell her her cabin is ready, and the choice is hers. She's late.")
    expect(fillCaptain(line, { name: 'Rin', pronouns: 'he' })).toBe("Rin? He made it. Tell him his cabin is ready, and the choice is his. He's late.")
  })
  it('keeps a name trimmed, at most 24 characters, never empty', () => {
    expect(captainName('  Rin  ')).toBe('Rin')
    expect(captainName('x'.repeat(30))).toHaveLength(24)
    expect(captainName('   ')).toBe('Captain')
  })
})
