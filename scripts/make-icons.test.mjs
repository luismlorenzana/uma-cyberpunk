// Validate the installed app's real branding exports without reading private authoring masters.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ICONS, LEGACY_ICONS } from './make-icons.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'apps/web/public/icons')

test('every authored app icon is an opaque square PNG at its declared size', () => {
  for (const [name, size] of Object.entries(ICONS)) {
    const bytes = readFileSync(join(dir, name))
    assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG', name)
    assert.equal(bytes.readUInt32BE(16), size, name)
    assert.equal(bytes.readUInt32BE(20), size, name)
    assert.equal(bytes[24], 8, name)
    assert.equal(bytes[25], 2, name)
  }
})

test('HTML and the install manifest reference the authored icon set and a separate maskable export', () => {
  const html = readFileSync(join(root, 'apps/web/index.html'), 'utf8')
  const vite = readFileSync(join(root, 'apps/web/vite.config.ts'), 'utf8')
  for (const name of Object.keys(ICONS)) assert.ok(vite.includes('/' + name) || vite.includes('icons/' + name), name)
  assert.ok(html.includes('/icons/uma-cyberpunk-v1-64.png'))
  assert.ok(html.includes('sizes="180x180" href="/icons/uma-cyberpunk-v1-touch-180.png"'))
  assert.ok(vite.includes("src: '/icons/uma-cyberpunk-v1-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'"))
  assert.ok(!readFileSync(join(dir, 'uma-cyberpunk-v1-512.png')).equals(readFileSync(join(dir, 'uma-cyberpunk-v1-maskable-512.png'))))
})

test('previous install-icon URLs serve the current approved branding', () => {
  for (const [legacy, current] of Object.entries(LEGACY_ICONS)) assert.ok(readFileSync(join(dir, legacy)).equals(readFileSync(join(dir, current))), legacy)
})
