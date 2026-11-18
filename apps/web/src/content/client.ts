// One authenticated content client for uma-platform's master data release, through cyber-api's /api/master proxy
// (uma-kit's content loader, as uma-rpg wires it).
import { idToken } from '@luismlorenzana/uma-kit/auth'
import { createContentClient } from '@luismlorenzana/uma-kit/content'
import { FIREBASE } from '../app/firebase-config'

export const CONTENT = createContentClient({
  token: () => idToken(FIREBASE),
  cacheName: 'cyber-master',
  // The pointer is mutable, and Hosting can retain an earlier 404 for its URL.
  fetch: (input, init) => input.endsWith('/content/campaign/preview.json')
    ? fetch(`${input}?check=${Date.now()}`, { ...init, cache: 'no-store' })
    : fetch(input, init),
})
