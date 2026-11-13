// The routes: Home and Account inside the shell; the board's test bench at /board, loaded on demand with three.js and the
// stage (CY7); the sandbox at /sandbox (CY8); the story's test route at /story (CY9); the ship at /, its rooms at
// /room/:id and the mission flow at /mission (CY10), the rooms' pages and the flow on demand. Home's account details
// moved to /home.
import { markStageRequested } from '@luismlorenzana/uma-stage'
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { Account } from '../home/Account'
import { Home } from '../home/Home'
import ShipScreen from '../ship/ShipScreen'
import { Shell } from '../shell/Shell'
import { Root } from './Root'

const BoardScreen = lazy(() => {
  markStageRequested()
  return import('../board/BoardScreen')
})
const SandboxScreen = lazy(() => {
  markStageRequested()
  return import('../sandbox/SandboxScreen')
})
const StoryScreen = lazy(() => import('../story/StoryScreen'))
const RoomPage = lazy(() => import('../ship/RoomPage'))
const MissionScreen = lazy(() => {
  markStageRequested()
  return import('../mission/MissionScreen')
})
const loading = <div className="fixed inset-0 flex items-center justify-center bg-page text-ink-soft">Loading the board…</div>

export const routes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      {
        element: <Shell />,
        children: [
          { path: 'home', element: <Home /> },
          { path: 'account', element: <Account /> },
        ],
      },
      { index: true, element: <ShipScreen /> },
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
