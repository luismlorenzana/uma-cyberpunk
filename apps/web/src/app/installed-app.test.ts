import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('the installed iOS app', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
  const meta = (name: string) => new RegExp(`<meta name="${name}" content="([^"]+)"`).exec(html)?.[1]

  it('uses an opaque status bar without giving up the bottom safe area (uma-rpg)', () => {
    expect(meta('apple-mobile-web-app-status-bar-style')).toBe('default')
    expect(meta('viewport')).toContain('viewport-fit=cover')
  })
  it('installs as a Home Screen app with its icon', () => {
    expect(meta('apple-mobile-web-app-capable')).toBe('yes')
    expect(html).toContain('href="/icons/uma-cyberpunk-v1-touch-180.png"')
  })
  it('ships the production sign-in config', () => {
    const env = readFileSync(resolve(process.cwd(), '.env.production'), 'utf8')
    expect(env).toMatch(/^VITE_FIREBASE_AUTH_DOMAIN=uma-cyberpunk\.web\.app$/m)
    expect(env).toMatch(/^VITE_FIREBASE_PROJECT_ID=uma-rpg$/m)
    expect(env).toMatch(/^VITE_FIREBASE_API_KEY=\S+$/m)
  })
})
