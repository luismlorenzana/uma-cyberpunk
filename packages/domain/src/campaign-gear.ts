import type { Rig, RigSlot } from './crew/parts'

export interface CampaignGear {
  alloy: number
  parts: string[]
}

export interface CampaignRecipe {
  part: string
  slot: RigSlot
  alloy: number
  icon: string
}

export interface CampaignWorkshop {
  after: string
  port: string
  missions: string[]
  recipes: CampaignRecipe[]
}

export const CAMPAIGN_WORKSHOP_ALLOY_MAX = 99
export const emptyCampaignGear = (): CampaignGear => ({ alloy: 0, parts: [] })

export const issuedCampaignRig = (main = 'hand-rifle', back = 'back-bulwark'): Rig => ({
  core: 'core-light', leftArm: 'arm-light', rightArm: 'arm-light', legs: 'legs-standard',
  visor: 'visor-aim', leftHand: null, rightHand: main, back, coat: null,
})
