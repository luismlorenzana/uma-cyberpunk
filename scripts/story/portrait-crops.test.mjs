import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import sharp from 'sharp'
import { require as loadTs } from 'tsx/cjs/api'

const { packCampaign } = loadTs('./campaign.ts', import.meta.url)
const { STAND_IN_FILES } = loadTs('../../packages/domain/src/story/stand-in.ts', import.meta.url)

test('pack publishes native dialogue and 192-pixel profiles and keeps face placement on the same part of the master', async () => {
  const parent = resolve(tmpdir())
  const dir = mkdtempSync(join(parent, 'cyber-portrait-'))
  const put = (file, bytes) => {
    const path = join(dir, file)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, typeof bytes === 'string' || Buffer.isBuffer(bytes) ? bytes : JSON.stringify(bytes))
  }
  const read = (file) => readFileSync(join(dir, file))
  const neutral = await sharp({ create: { width: 400, height: 600, channels: 4, background: '#402863' } }).png().toBuffer()
  const face = await sharp({ create: { width: 50, height: 60, channels: 4, background: '#ff8466' } }).png().toBuffer()
  try {
    for (const [name, file] of Object.entries(STAND_IN_FILES)) put(name, file)
    put('art/neutral.png', neutral)
    put('art/face.png', face)
    put('campaign.json', {
      schemaVersion: 1, draft: true, opening: 'opening',
      quests: [{ id: 'opening', scene: 'sw1-ch1-s1', title: 'Opening' }],
      assets: [{ id: 'pilot', file: 'neutral.png' }, { id: 'worried', file: 'face.png' }],
      art: [{ scene: 'sw1-ch1-s1', backdrop: 'pilot', portraits: [{ speaker: 9000001, asset: 'pilot' }] }],
      portraitFaces: [{ speaker: 9000001, base: 'pilot', emote: 'worried', asset: 'worried', at: { x: 100, y: 120 } }],
    })
    const source = { schemaVersion: 1, crops: [{
      base: 'pilot', dialogue: { left: 50, top: 20, width: 300, height: 400 }, profile: { left: 60, top: 40, size: 210 },
    }] }
    put('portrait-crops.json', source)
    const release = await packCampaign(dir, join(dir, 'release'), 'derived')
    const packed = JSON.parse(read('release/' + release.files.find(({ source }) => source === 'campaign.json').path))
    assert.deepEqual(packed.art[0], { scene: 'sw1-ch1-s1', backdrop: 'pilot',
      portraits: [{ speaker: 9000001, asset: 'pilot-dialogue', profile: 'pilot-profile' }] })
    assert.deepEqual(packed.portraitFaces[0].at, { x: 50, y: 100 })
    assert.equal(packed.portraitFaces[0].base, 'pilot-dialogue')
    assert.equal(release.assets.find(({ id }) => id === 'pilot').sha256, createHash('sha256').update(neutral).digest('hex'))
    for (const [id, width, height] of [['pilot-dialogue', 300, 400], ['pilot-profile', 192, 192]]) {
      const ref = release.assets.find((asset) => asset.id === id)
      const meta = await sharp(read('release/' + ref.path)).metadata()
      assert.equal(meta.format, 'webp')
      assert.equal(meta.width, width)
      assert.equal(meta.height, height)
    }
    assert.equal(JSON.parse(read('campaign.json')).art[0].portraits[0].asset, 'pilot')

    source.crops[0].dialogue.left = 120
    put('portrait-crops.json', source)
    await assert.rejects(packCampaign(dir, join(dir, 'release'), 'outside-master'), /dialogue: crop extends beyond/)
    source.crops[0].dialogue.width = 200
    put('portrait-crops.json', source)
    await assert.rejects(packCampaign(dir, join(dir, 'release'), 'outside-dialogue'), /worried: crop extends beyond/)
  } finally {
    assert.equal(dirname(resolve(dir)), parent)
    rmSync(dir, { recursive: true, force: true })
  }
})
