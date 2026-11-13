// The committed icons are exactly what scripts/make-icons.mjs draws (CY3), so the mark can be redrawn from code alone. It
// compares decoded pixels, not file bytes: zlib's compressed output differs between platforms (macOS and CI's Linux).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'
import { ICONS, pixels } from './make-icons.mjs'

const dir = join(dirname(fileURLToPath(import.meta.url)), '../apps/web/public/icons')

/** A PNG's header fields and its inflated image data. */
function decode(bytes) {
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG')
  const idat = []
  let header = null
  for (let at = 8; at < bytes.length;) {
    const length = bytes.readUInt32BE(at), type = bytes.subarray(at + 4, at + 8).toString('ascii'), data = bytes.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') header = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], colour: data[9] }
    if (type === 'IDAT') idat.push(data)
    at += 12 + length
  }
  return { header, image: inflateSync(Buffer.concat(idat)) }
}

test('every committed icon is a square 8-bit RGB PNG at its size', () => {
  for (const [name, size] of Object.entries(ICONS)) assert.deepEqual(decode(readFileSync(join(dir, name))).header, { width: size, height: size, depth: 8, colour: 2 }, name)
})

test('every committed icon shows exactly what the generator draws', () => {
  for (const [name, size] of Object.entries(ICONS)) assert.ok(decode(readFileSync(join(dir, name))).image.equals(pixels(size)), `${name} is stale: run node scripts/make-icons.mjs`)
})
