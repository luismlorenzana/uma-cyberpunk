import './index.css'

import { AuthProvider, idToken } from '@luismlorenzana/uma-kit/auth'
import { watchAppUpdates } from '@luismlorenzana/uma-kit/places'
import { configureKit, initAppearance, MotionRoot } from '@luismlorenzana/uma-kit/ui'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { registerSW } from 'virtual:pwa-register'
import { setTokenProvider } from './api/client'
import { FIREBASE } from './app/firebase-config'
import { router } from './app/router'

// uma-kit, wired as uma-rpg does: this game's device keys, the phone's appearance, the kit's sign-in and its update
// prompt. The API's token comes from the kit, and a new build waits for Restart.
configureKit({ storagePrefix: 'cyber.' })
initAppearance()
watchAppUpdates(registerSW)
setTokenProvider(() => idToken(FIREBASE))

const root = document.getElementById('root')
if (!root) throw new Error('missing #root')

createRoot(root).render(
  <StrictMode>
    <MotionRoot>
      <AuthProvider config={FIREBASE}>
        <RouterProvider router={router} />
      </AuthProvider>
    </MotionRoot>
  </StrictMode>,
)
