// The app icon (CY3): a neon ring with a gap on uma-kit's dark ink, original and abstract, drawn in code so it costs no art
// and exports the same bytes every time (copied from uma-quest's at cc42fd1, with this game's mark). Real icon art is
// Claude's code-drawn pixel art later (uma-platform P147); iOS keeps the icon it saw at Add to Home Screen, so a change
// means a reinstall. Run: node scripts/make-icons.mjs (writes apps/web/public/icons/).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const INK = [0x0b, 0x0d, 0x17] // the app's dark background (theme_color)
const NEON = [0x2e, 0xe6, 0xff] // the ring
const GLOW = [0xff, 0x3d, 0xc8] // the halo around it
const SAMPLES = 4 // 4 × 4 samples a pixel for clean edges

/** The ring's colour weight and the halo's at a point in the unit square, inside the maskable safe zone (10 %–90 %). The
 * ring is open at its upper right, between 20° and 70° above the horizontal, with round ends. */
function mark(x, y) {
  const cx = 0.5, cy = 0.5, radius = 0.27, half = 0.045, halo = 0.07
  const angle = Math.atan2(cy - y, x - cx) // up is positive
  const from = (20 * Math.PI) / 180, to = (70 * Math.PI) / 180
  let distance
  if (angle > from && angle < to) {
    // In the gap: the distance to the nearer round end.
    const ends = [from, to].map((a) => [cx + radius * Math.cos(a), cy - radius * Math.sin(a)])
    distance = Math.min(...ends.map(([ex, ey]) => Math.hypot(x - ex, y - ey)))
  } else distance = Math.abs(Math.hypot(x - cx, y - cy) - radius)
  if (distance <= half) return { ring: 1, glow: 0 }
  const fall = 1 - Math.min(1, (distance - half) / halo)
  return { ring: 0, glow: fall * fall * 0.55 }
}

export function pixels(size) {
  const rows = []
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 3) // filter byte 0, then RGB
    for (let px = 0; px < size; px++) {
      let ring = 0, glow = 0
      for (let sy = 0; sy < SAMPLES; sy++)
        for (let sx = 0; sx < SAMPLES; sx++) {
          const m = mark((px + (sx + 0.5) / SAMPLES) / size, (py + (sy + 0.5) / SAMPLES) / size)
          ring += m.ring
          glow += m.glow
        }
      const r = ring / (SAMPLES * SAMPLES), g = (glow / (SAMPLES * SAMPLES)) * (1 - r)
      for (let c = 0; c < 3; c++) row[1 + px * 3 + c] = Math.round(INK[c] * (1 - r - g) + NEON[c] * r + GLOW[c] * g)
    }
    rows.push(row)
  }
  return Buffer.concat(rows)
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
function crc32(buf) {
  let c = -1
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4), crc = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  len.writeUInt32BE(data.length)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
export function png(size) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 2, 0, 0, 0], 8) // 8-bit RGB, no interlace
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels(size), { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

export const ICONS = { 'icon-64.png': 64, 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512 }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = join(dirname(fileURLToPath(import.meta.url)), '../apps/web/public/icons')
  mkdirSync(out, { recursive: true })
  for (const [name, size] of Object.entries(ICONS)) writeFileSync(join(out, name), png(size))
  console.log(`icons → ${out}`)
}
