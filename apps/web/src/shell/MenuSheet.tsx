// The menu (CY3): Home and Account, sign-out, and the build at the foot. CY10 turns it into the ship's rooms (uma-kit's
// PlaceMenu, as uma-farm's).
import { useAuth } from '@luismlorenzana/uma-kit/auth'
import { PlaceMenu } from '@luismlorenzana/uma-kit/shell'
import { Button, Sheet } from '@luismlorenzana/uma-kit/ui'
import { APP_BUILD_ID } from '../app/build'

export function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const auth = useAuth()
  return (
    <Sheet open={open} onClose={onClose} title="Menu">
      <PlaceMenu groups={[]} extra={[{ key: 'home', name: 'Home', to: '/' }, { key: 'account', name: 'Account', to: '/account' }]} />
      {auth.authRequired && (
        <div className="mt-4"><Button variant="secondary" onClick={() => void auth.signOut()}>Sign out</Button></div>
      )}
      <p className="mt-4 text-center text-[12px] text-ink-faint">Build {APP_BUILD_ID}</p>
    </Sheet>
  )
}
