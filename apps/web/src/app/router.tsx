// The routes: Home and Account inside the shell. CY8 adds the sandbox, CY10 the ship's rooms.
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { Account } from '../home/Account'
import { Home } from '../home/Home'
import { Shell } from '../shell/Shell'
import { Root } from './Root'

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
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
