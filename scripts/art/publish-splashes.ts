import { publishSplashAlbums, readSplashAlbums, SPLASH_ROLES } from './splash-platform'
import { GcsArtStorage, SCENE_SPLASH_PREFIX } from './storage'

const [root, ...flags] = process.argv.slice(2)
const roleFlag = flags.find(flag => flag.startsWith('--role='))
const role = roleFlag && SPLASH_ROLES.find(value => roleFlag === '--role=' + value)
if (!root || flags.some(flag => flag !== '--dry-run' && flag !== '--role=' + role) || new Set(flags).size !== flags.length) {
  throw new Error('Pass the Cyberpunk Art authoring root [--dry-run] [--role=crew|boss-ally|boss-enemy|lieutenant]')
}
void readSplashAlbums(root, role || undefined).then(catalog => publishSplashAlbums(catalog, new GcsArtStorage(undefined, undefined, SCENE_SPLASH_PREFIX), flags.includes('--dry-run'),
  (done, total) => console.log(`Verified ${done}/${total} approved splashes`)))
  .then(result => console.log(JSON.stringify(result)), (error: Error) => { console.error(error.message); process.exitCode = 1 })
