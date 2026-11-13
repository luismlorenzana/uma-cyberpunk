// The shell (uma-kit's AppFrame at its night tint, as uma-farm wires it; CY3): the account bar with the sync chip, the
// page between, the bottom bar (Home · Account · Menu), and the menu sheet at `?sheet=menu` on the route it opens over, so
// Back closes it. The ship's rooms replace Home's tab in CY10.
import { useAuth } from '@luismlorenzana/uma-kit/auth'
import { AccountBar, AppFrame, BottomBar, useLeave, withParam, type SyncState } from '@luismlorenzana/uma-kit/shell'
import { HomeIcon, SettingsIcon } from '@luismlorenzana/uma-kit/ui'
import { Outlet, useLocation } from 'react-router'
import { useGame, type SyncStatus } from '../save/game'
import { MenuSheet } from './MenuSheet'
import { SyncWarning } from './SyncWarning'

const BAR_SYNC: Record<SyncStatus, SyncState | null> = { idle: 'waiting', syncing: 'waiting', synced: null, offline: 'offline', error: 'paused' }
const BAR_WORDS: Record<SyncStatus, string> = { idle: 'Waiting', syncing: 'Syncing', synced: 'Synced', offline: 'Offline', error: 'Sync paused' }

export function CyberAccountBar() {
  const auth = useAuth()
  const location = useLocation()
  const sync = useGame((s) => s.sync)
  const name = auth.user?.name ?? auth.user?.email ?? 'Local'
  const state = BAR_SYNC[sync]
  return (
    <AccountBar
      initial={name.slice(0, 1).toUpperCase()}
      account={{ to: '/account', label: `Account: ${name}` }}
      chips={[]}
      sync={state ? { state, text: BAR_WORDS[sync], label: `Save: ${BAR_WORDS[sync]}`, to: '/account' } : undefined}
      menu={{ to: withParam(location, 'sheet', 'menu'), label: 'Menu', text: 'Menu' }}
    />
  )
}

export function CyberBottomBar() {
  const location = useLocation()
  return (
    <BottomBar label="Pages" menu={{ to: withParam(location, 'sheet', 'menu'), label: 'Menu', text: 'Menu' }} tabs={[
      { key: 'home', to: '/', label: 'Home', Icon: HomeIcon, active: location.pathname === '/' },
      { key: 'account', to: '/account', label: 'Account', Icon: SettingsIcon, active: location.pathname === '/account' },
    ]} />
  )
}

export function Shell() {
  const location = useLocation()
  const leave = useLeave()
  const sheet = new URLSearchParams(location.search).get('sheet')
  return (
    <AppFrame
      tint="night"
      top={<><CyberAccountBar /><SyncWarning /></>}
      bottom={<CyberBottomBar />}
      overlays={<MenuSheet open={sheet === 'menu'} onClose={() => leave(withParam(location, 'sheet', null))} />}
    >
      <Outlet />
    </AppFrame>
  )
}
