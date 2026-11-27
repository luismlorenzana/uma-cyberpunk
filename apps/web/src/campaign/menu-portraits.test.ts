import { expect, it } from 'vitest'
import type { CampaignReleaseFile, CampaignWardrobe } from '@cyber/domain'
import { menuPortrait } from './menu-portraits'

function pin(path: string): CampaignReleaseFile {
  return { path, bytes: 1, sha256: 'a'.repeat(64) }
}

it('uses the approved dialogue portrait when the outfit has no square crop', () => {
  const profile = pin('profile.webp'), portrait = pin('portrait.png'), full = pin('full.png')
  const assets = new Map([['profile', profile], ['portrait', portrait], ['full', full]])
  const member: CampaignWardrobe['members'][number] = { speaker: 1, looks: { 'ship-casual': { asset: 'full', portrait: 'portrait' } } }
  expect(menuPortrait(member, assets, ['ship-casual'])).toBe(portrait)
  member.looks['ship-casual']!.profile = 'profile'
  expect(menuPortrait(member, assets, ['ship-casual'])).toBe(profile)
})

it('can use a cast-matched fallback even when its preferred aspect is unavailable', () => {
  const portrait = pin('portrait.png')
  const assets = new Map([['portrait', portrait]])
  expect(menuPortrait(undefined, assets, ['street'], { speaker: 1, asset: 'portrait', profile: 'missing' })).toBe(portrait)
})
