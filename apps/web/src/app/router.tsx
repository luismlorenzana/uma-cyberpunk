// The routes: Home and Account inside the shell; the board's test bench at /board, loaded on demand with three.js and the
// stage (CY7); the sandbox at /sandbox (CY8); the story's test route at /story (CY9); the ship at /, its rooms at
// /room/:id and the mission flow at /mission (CY10), the rooms' pages and the flow on demand. Home's account details
// moved to /home. Since CY16 the ship loads on demand too, so the first download stays under the 180 KB budget: the ship's
// screen, the director and the scene player arrive as their own chunk the moment the app opens on it.
import { markStageRequested } from '@luismlorenzana/uma-stage'
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { Account } from '../home/Account'
import { Home } from '../home/Home'
import { Shell } from '../shell/Shell'
import { Root } from './Root'
import { CAMPAIGN_ENTRY, inCampaign } from './campaign'

const BoardScreen = lazy(() => {
  markStageRequested()
  return import('../board/BoardScreen')
})
const SandboxScreen = lazy(() => {
  markStageRequested()
  return import('../sandbox/SandboxScreen')
})
const ShipScreen = lazy(() => import('../ship/ShipScreen'))
const StoryScreen = lazy(() => import('../story/StoryScreen'))
const RoomPage = lazy(() => import('../ship/RoomPage'))
const MissionScreen = lazy(() => {
  markStageRequested()
  return import('../mission/MissionScreen')
})
const CampaignScreen = lazy(() => {
  markStageRequested()
  return import('../campaign/CampaignScreen')
})
const CampaignAccount = lazy(() => {
  markStageRequested()
  return import('../campaign/CampaignScreen').then((module) => ({ default: module.CampaignAccount }))
})
const loading = <div className="fixed inset-0 flex items-center justify-center bg-page text-ink-soft">Loading the board…</div>
const boarding = <div className="fixed inset-0 flex items-center justify-center bg-[#0b0d17] text-white/60">Boarding…</div>

export const routes: RouteObject[] = [
  {
    element: <Root />,
    children: inCampaign ? [
      { path: 'campaign', element: <Suspense fallback={boarding}><CampaignScreen /></Suspense> },
      { path: 'campaign/account', element: <Suspense fallback={boarding}><CampaignAccount /></Suspense> },
      { path: '*', element: <Navigate to={CAMPAIGN_ENTRY} replace /> },
    ] : [
      {
        element: <Shell />,
        children: [
          { path: 'home', element: <Home /> },
          { path: 'account', element: <Account /> },
        ],
      },
      { index: true, element: <Suspense fallback={boarding}><ShipScreen /></Suspense> },
      { path: 'room/:id', element: <Suspense fallback={loading}><RoomPage /></Suspense> },
      { path: 'mission', element: <Suspense fallback={loading}><MissionScreen /></Suspense> },
      { path: 'board', element: <Suspense fallback={loading}><BoardScreen /></Suspense> },
      { path: 'sandbox', element: <Suspense fallback={loading}><SandboxScreen /></Suspense> },
      { path: 'story', element: <Suspense fallback={loading}><StoryScreen /></Suspense> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
