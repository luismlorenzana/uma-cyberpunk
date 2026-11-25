import { markStageRequested } from '@luismlorenzana/uma-stage'
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { Root } from './Root'
import { campaignAccount, campaignEntry } from './campaign'

const CampaignScreen = lazy(() => {
  markStageRequested()
  return import('../campaign/CampaignScreen')
})
const CampaignAccount = lazy(() => {
  markStageRequested()
  return import('../campaign/CampaignScreen').then((module) => ({ default: module.CampaignAccount }))
})
const boarding = <div className="fixed inset-0 flex items-center justify-center bg-[#0b0d17] text-white/60">Boarding…</div>

export const routes: RouteObject[] = [{
  element: <Root />,
  children: [
    { path: campaignEntry, element: <Suspense fallback={boarding}><CampaignScreen /></Suspense> },
    { path: campaignAccount, element: <Suspense fallback={boarding}><CampaignAccount /></Suspense> },
    ...['/account', '/campaign/pilot/account', '/campaign/four-act/account'].map(path => ({
      path, element: <Navigate to={campaignAccount} replace />,
    })),
    { path: '*', element: <Navigate to={campaignEntry} replace /> },
  ],
}]

export const router = createBrowserRouter(routes)
