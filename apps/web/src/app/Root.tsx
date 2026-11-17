// Getting in (copied from uma-quest's at cc42fd1, itself uma-rpg's at 30a322a): the kit's gates (uma-platform P56):
// splash → sign-in → boot → the shell, with this game's boot (the device save, else the server's, else a new account)
// and master data behind uma-farm's MasterGate. The update prompt sits outside the gates, so a waiting build shows even
// on the sign-in screen.
import { useAuth } from '@luismlorenzana/uma-kit/auth'
import { BootGates, UpdateNotice } from '@luismlorenzana/uma-kit/places'
import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { loadMaster } from '../master/master'
import { MasterGate } from '../master/MasterGate'
import { boot, startSyncTriggers } from '../save/game'
import { signInEnabled } from './firebase-config'
import { inCampaign } from './campaign'

async function bootFor({ uid }: { uid: string }): Promise<{ firstLaunch: boolean }> {
  loadMaster()
  await boot(uid)
  return { firstLaunch: false }
}

export function Root() {
  const auth = useAuth()
  useEffect(() => startSyncTriggers(), [])
  // Never run a production build signed out: every API call would fail (uma-rpg's S1 incident, its D42).
  if (import.meta.env.PROD && !signInEnabled)
    return <div className="fixed inset-0 flex items-center justify-center bg-page p-8 text-center text-ink-soft">This build is missing its sign-in configuration.</div>
  return (
    <>
      <UpdateNotice />
      <BootGates auth={auth} boot={bootFor} words={{ name: 'Uma Cyberpunk', tagline: 'Rigs up. Lights out.' }}>
        {inCampaign ? <Outlet /> : <MasterGate><Outlet /></MasterGate>}
      </BootGates>
    </>
  )
}
