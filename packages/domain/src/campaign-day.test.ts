import { describe, expect, it } from 'vitest'
import { finishCampaignNightScene, firstCampaignDay, startCampaignNight, type CampaignNight } from './campaign-day'
import { newSave, parseSave } from './save/save'

const visit: Extract<CampaignNight, { kind: 'visit' }> = {
  kind: 'visit', companion: 9000999, scene: 'quarters-visit', morning: 'morning-brief',
}
const NOW = '2026-11-17T18:00:00.000Z'

describe('the campaign day', () => {
  it('resumes the chosen visit, advances once and resumes the following morning', () => {
    const start = startCampaignNight(firstCampaignDay(), visit)
    const fromDevice = parseSave(JSON.parse(JSON.stringify({ ...newSave('u', NOW), campaignDay: start }))).campaignDay
    expect(fromDevice).toEqual(start)
    expect(startCampaignNight(fromDevice, null)).toBe(fromDevice)
    const morning = finishCampaignNightScene(fromDevice, 1, visit)
    expect(morning).toEqual({ day: 2, pending: { kind: 'morning', companion: visit.companion, scene: 'morning-brief' } })
    expect(finishCampaignNightScene(morning, 1, visit)).toBe(morning)
    expect(finishCampaignNightScene(morning, 2, morning.pending!)).toEqual({ day: 2, pending: null })
  })

  it('adds a fresh clock when migrating a v10 save without changing its story or timestamp', () => {
    const { management: _management, cabinVisits: _cabinVisits, campaignDay: _, campaignSupply: _supply, commandCrew: _command, pairScene: _pair, campaignGear: _gear, campaignProjects: _projects, commandTraining: _training, ...old } = newSave('u', NOW)
    const migrated = parseSave({ ...old, version: 10, story: { ...old.story, flags: ['previous-choice'] } })
    expect(migrated.campaignDay).toEqual(firstCampaignDay())
    expect(migrated.story.flags).toEqual(['previous-choice'])
    expect(migrated.account.updatedAt).toBe(NOW)
    expect(startCampaignNight(migrated.campaignDay, null)).toEqual({ day: 2, pending: null })
  })
})
