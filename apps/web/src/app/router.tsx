// The routes: Home and Account inside the shell; the board's test bench at /board, loaded on demand with three.js and the
// stage (CY7); the sandbox at /sandbox (CY8); the story's test route at /story (CY9). CY10 adds the ship's rooms.
import { markStageRequested } from '@luismlorenzana/uma-stage'
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { Account } from '../home/Account'
import { Home } from '../home/Home'
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
const loading = <div className="fixed inset-0 flex items-center justify-center bg-page text-ink-soft">Loading the board…</div>

export const routes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      {
        element: <Shell />,
        children: [
          { index: true, element: <Home /> },
          { path: 'account', element: <Account /> },
        ],
      },
      { path: 'board', element: <Suspense fallback={loading}><BoardScreen /></Suspense> },
      { path: 'sandbox', element: <Suspense fallback={loading}><SandboxScreen /></Suspense> },
      { path: 'story', element: <Suspense fallback={loading}><StoryScreen /></Suspense> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
