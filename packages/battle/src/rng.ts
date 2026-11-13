// The seeded roll (CY4): a hash of `seed:turn:unit:purpose:n` to a number in [0, 1). The battle's turn number keys it, so
// two turns of one unit in a round never share a roll. Nothing unseeded anywhere in the package (a test scans for it).

/** FNV-1a over the text, then murmur3's finaliser, so neighbouring keys spread evenly. */
export function hash32(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

export function roll(seed: string, turn: number, unit: string, purpose: string, n = 0): number {
  return hash32(`${seed}:${turn}:${unit}:${purpose}:${n}`) / 0x1_0000_0000
}
