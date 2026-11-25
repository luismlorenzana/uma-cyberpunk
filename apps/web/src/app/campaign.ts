import type { CampaignSaveScope } from '@cyber/domain'

export const CAMPAIGN_ENTRY = '/campaign'
export const campaignEntry = CAMPAIGN_ENTRY
export const campaignAccount = `${campaignEntry}/account`
export const campaignIdentity = 'four-act' as const
export const saveScope: CampaignSaveScope = campaignIdentity
