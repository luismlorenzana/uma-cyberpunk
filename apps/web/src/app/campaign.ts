/** A campaign switch is a document navigation so each store and its pending sync stay in their own save scope. */
export const CAMPAIGN_ENTRY = '/campaign'
export const inCampaign = typeof window !== 'undefined' && /^\/campaign(?:\/|$)/.test(window.location.pathname)
