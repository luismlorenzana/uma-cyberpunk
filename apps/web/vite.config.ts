import { mkdirSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { CAMPAIGN_ENTRY } from './src/app/campaign'
import { localCombatSpriteReview } from './local-combat-sprite-review'

const buildId = (process.env.VITE_APP_BUILD_ID ?? process.env.GITHUB_SHA ?? 'local').slice(0, 12)

/** Writes which source modules each chunk renders to dist/.vite/chunks.json (never deployed or precached), so the size
 * check can refuse a lazy module in the initial JS (scripts/check-size.mjs, copied from uma-rpg). */
function chunkModules(): Plugin {
  let root = ''
  return {
    name: 'cyber-chunk-modules',
    apply: 'build',
    configResolved(config) { root = config.root },
    writeBundle(options, bundle) {
      const chunks: Record<string, string[]> = {}
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue
        chunks[output.fileName] = Object.entries(output.modules).filter(([id, m]) => m.renderedLength > 0 && !id.startsWith('\0'))
          .map(([id]) => relative(root, id.split('?')[0]!).split(sep).join('/'))
      }
      const dir = join(options.dir ?? join(root, 'dist'), '.vite')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'chunks.json'), `${JSON.stringify(chunks, null, 1)}\n`)
    },
  }
}

export default defineConfig(({ mode }) => {
  const combatReview = mode === 'development' ? process.env.CYBER_COMBAT_SPRITE_REVIEW : undefined
  // A production build without the Firebase web config would run signed out and every API call would get a 401
  // (uma-rpg D42). Fail the build instead: apps/web/.env.production is committed.
  if (mode === 'production') {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const missing = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID'].filter((k) => !env[k])
    if (missing.length > 0) throw new Error(`Production build is missing ${missing.join(', ')} (apps/web/.env.production)`)
  }
  return {
    define: { __APP_BUILD_ID__: JSON.stringify(buildId), 'import.meta.env.CYBER_COMBAT_SPRITE_REVIEW': JSON.stringify(!!combatReview) },
    plugins: [
      react(),
      tailwindcss(),
      chunkModules(),
      ...(combatReview ? [localCombatSpriteReview(combatReview)] : []),
      VitePWA({
        // The kit's "Update ready · Restart" prompt instead of a silent reload (watchAppUpdates in main.tsx).
        registerType: 'prompt',
        injectRegister: null,
        // The icon is generated (scripts/make-icons.mjs). iOS keeps the icon it saw at Add to Home Screen.
        includeAssets: ['icons/icon-64.png', 'icons/apple-touch-icon.png'],
        manifest: {
          name: 'Uma Cyberpunk',
          short_name: 'Uma Cyberpunk',
          description: 'Personal sci-fi tactics RPG',
          display: 'standalone',
          // iOS can't lock a web app's orientation; the turned stage (CY7, TC1) draws landscape either way.
          orientation: 'any',
          id: '/',
          scope: '/',
          start_url: CAMPAIGN_ENTRY,
          background_color: '#0b0d17',
          theme_color: '#0b0d17',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          // three.js arrives as a lazy chunk in CY7: precache it too, so the game opens offline after install.
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          navigateFallback: '/index.html',
          // /__/ is Firebase Hosting's reserved space (the sign-in handler): never answer it with the app shell.
          navigateFallbackDenylist: [/^\/api\//, /^\/__\//],
          runtimeCaching: [
            {
              // Master data files are named by hash: cache forever on the device once downloaded.
              urlPattern: ({ url }) => url.pathname.startsWith('/api/master/files/') || url.pathname.startsWith('/api/master/manifests/'),
              handler: 'CacheFirst',
              options: { cacheName: 'cyber-master-files', expiration: { maxEntries: 4000 } },
            },
            {
              // The channel pointer changes with each release: prefer the network, fall back to the last one offline.
              urlPattern: ({ url }) => url.pathname.startsWith('/api/master/channels/'),
              handler: 'NetworkFirst',
              options: { cacheName: 'cyber-master-channel', networkTimeoutSeconds: 4 },
            },
          ],
        },
      }),
    ],
    resolve: {
      // uma-kit's peers resolve to this app's copies.
      dedupe: ['react', 'react-dom', 'react-router', 'motion'],
    },
    build: { target: 'es2022', manifest: true },
    server: { port: 5214, strictPort: true, host: combatReview ? '127.0.0.1' : true, proxy: { '/api': 'http://localhost:8121' } },
    preview: { port: 5214 },
    // uma-kit goes through Vite in tests, so it shares this app's react-router instance (and its context).
    test: { environment: 'node', server: { deps: { inline: ['@luismlorenzana/uma-kit'] } } },
  }
})
