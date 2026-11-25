import { publishSplashAlbums, readSplashAlbums } from './splash-platform'
import { GcsArtStorage, SCENE_SPLASH_PREFIX } from './storage'

const [root, mode] = process.argv.slice(2)
if (!root || (mode !== undefined && mode !== '--dry-run')) throw new Error('Pass the Cyberpunk Art authoring root [--dry-run]')
void readSplashAlbums(root).then(catalog => publishSplashAlbums(catalog, new GcsArtStorage(undefined, undefined, SCENE_SPLASH_PREFIX), mode === '--dry-run',
  (done, total) => console.log(`Verified ${done}/${total} approved splashes`)))
  .then(result => console.log(JSON.stringify(result)), (error: Error) => { console.error(error.message); process.exitCode = 1 })
