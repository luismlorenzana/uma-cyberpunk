import { AuthProvider } from '@luismlorenzana/uma-kit/auth'
import { renderToString } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Shell } from '../shell/Shell'
import { Home } from './Home'
import { shortTime } from './sync-words'

describe('Home', () => {
  // Server rendering reads the store's first state (zustand's server snapshot): a save not yet synced.
  it('shows the game, the account, the save, its revision and master data, in the shell', () => {
    const router = createMemoryRouter([{ element: <Shell />, children: [{ path: '/', element: <Home /> }] }])
    const html = renderToString(<AuthProvider config={null}><RouterProvider router={router} /></AuthProvider>)
    expect(html).toContain('uma-cyberpunk')
    expect(html).toContain('Local')
    expect(html).toContain('Saved on this phone')
    expect(html).toContain('Revision')
    expect(html).toContain('Master data')
    expect(html).toContain('Sync now')
  })

  it('says when the save last synced', () => {
    const now = new Date('2026-11-08T15:00:00')
    expect(shortTime(null, now)).toBe('Never')
    expect(shortTime(new Date('2026-11-01T10:00:00').toISOString(), now)).not.toContain(':')
  })
})
