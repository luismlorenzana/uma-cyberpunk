import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { campaignPreviewIndex, campaignReleasePath, combatSpriteKey, parseCombatSpriteIdentity, P,
  type CampaignIdentity, type CampaignReleaseFile, type CombatSpriteIdentity } from '../../packages/domain/src/story/index'
import { readCombatSprite, withCombatSprites } from './combat-sprites'
import { concurrent } from './concurrent'
import { sha } from './model'
import { immutable, type SelectedCampaign } from './publish'
import { CAMPAIGN_PREFIX, COMBAT_SPRITE_PREFIX, GenerationConflict, type ArtStorage, type StoredObject } from './storage'

function encode(value: unknown) { return Buffer.from(JSON.stringify(value)) }
const versionNumber = (version: string) => Number(version.slice(1))

export async function readSpriteApprovalIndex(file: string, only: readonly string[]) {
  const bytes = await readFile(file)
  const p = new P(file)
  const root = p.object(JSON.parse(bytes.toString('utf8')), 'publication', ['schemaVersion', 'universe', 'campaign', 'revision', 'bundles'])
  p.version(root)
  if (root.universe !== 'cyberpunk' || root.campaign !== 'cyberpunk') p.fail('campaign', 'expected current Cyberpunk campaign')
  const digest = (value: unknown, field: string) => {
    const text = p.text(value, field, 64)
    if (!/^[a-f0-9]{64}$/.test(text)) p.fail(field, 'expected SHA-256')
    return text
  }
  const bundles = p.list(root.bundles, 'bundles', (value, field) => {
    const required = ['character', 'outfit', 'version', 'manifestSha256', 'approval']
    const row = p.object(value, field, [...required, 'directory', 'placementsSha256', 'pages', 'form', 'roles'], required)
    const character = p.slug(row.character, field + '.character')
    const identity = parseCombatSpriteIdentity(p, row, field)
    const version = p.text(row.version, field + '.version', 7)
    if (!/^v\d{3,6}$/.test(version)) p.fail(field + '.version', 'expected a sprite bundle version')
    const manifest = digest(row.manifestSha256, field + '.manifestSha256')
    const approval = p.object(row.approval, field + '.approval', ['by', 'status'])
    if (approval.by !== 'owner') p.fail(field + '.approval.by', 'expected owner approval')
    if (approval.status === 'withdrawn') {
      if (row.directory !== undefined || row.pages !== undefined || row.placementsSha256 !== undefined) p.fail(field, 'withdrawal only pins the withdrawn manifest')
      return { character, ...identity, version, manifest, status: 'withdrawn' as const }
    }
    if (approval.status !== 'approved') p.fail(field + '.approval.status', 'sprite payload approval is pending')
    const directory = resolve(dirname(file), p.text(row.directory, field + '.directory', 1024))
    const placements = digest(row.placementsSha256, field + '.placementsSha256')
    const pages = p.list(row.pages, field + '.pages', (value, field) => {
      const page = p.object(value, field, ['file', 'sha256'])
      return { file: p.text(page.file, field + '.file', 240), sha256: digest(page.sha256, field + '.sha256') }
    }, 128)
    return { character, ...identity, version, manifest, status: 'approved' as const, directory, placements, pages }
  }, 512)
  if (new Set(bundles.map(combatSpriteKey)).size !== bundles.length) {
    p.fail('bundles', 'duplicate sprite identities')
  }
  const matches = (row: typeof bundles[number], selector: string) =>
    row.character === selector || String(row.outfit) === selector || combatSpriteKey(row) === selector
  for (const selector of only) if (!bundles.some(row => matches(row, selector))) throw new Error(`Unregistered combat sprite identity: ${selector}`)
  const scoped = bundles.filter(row => !only.length || only.some(selector => matches(row, selector)))
  if (!scoped.length) throw new Error('No approved or withdrawn combat sprite entries in scope')
  return { bundles: scoped, revision: p.text(root.revision, 'revision', 160), sha256: sha(bytes), assertCurrent: async () => {
    if (!(await readFile(file)).equals(bytes)) throw new GenerationConflict('Combat sprite approval index changed')
  } }
}

type SourceIndex = Awaited<ReturnType<typeof readSpriteApprovalIndex>>
type SpriteSource = SourceIndex['bundles'][number]
const identityOf = (source: SpriteSource): CombatSpriteIdentity => source.form === undefined
  ? { outfit: source.outfit } : { outfit: source.outfit, form: source.form, roles: source.roles }

/** The current book, including its alternate encounters, owns role and fixed-fitting assignments. */
function heroineFittings(book: SelectedCampaign['book'], source: Extract<CombatSpriteIdentity, { outfit: string }>) {
  const required = new Set<string>()
  for (const role of source.roles) {
    let admitted = role === 'boss-ally' && source.form === 'standard' && book.allies?.some(ally => ally.heroine === source.outfit)
    for (const ground of book.ground.values()) {
      if (role === 'boss-enemy' && ground.rescue?.heroine === source.outfit && (ground.rescue.spriteForm ?? 'standard') === source.form) {
        admitted = true
        required.add(ground.rescue.unit)
      }
      const formation = ground.formation
      if (role === 'boss-ally' && !formation?.advisory && formation?.ally.heroine === source.outfit && (formation.ally.spriteForm ?? 'standard') === source.form) admitted = true
      for (const opponent of formation?.opponents ?? []) {
        if (opponent.heroine !== source.outfit || (opponent.spriteRole ?? 'sub-boss') !== role ||
          (opponent.spriteForm ?? 'standard') !== source.form) continue
        admitted = true
        required.add(opponent.from)
      }
    }
    if (!admitted) throw new Error(`Combat sprite role/form has no authored encounter or deployment: ${source.outfit}/${source.form}/${role}`)
  }
  return required
}
interface PlatformPlan { path: string; prior: StoredObject | null; bytes: Buffer; payloads?: Map<string, Buffer> }

function verifyPlatformVersion(prior: StoredObject | null, source: SpriteSource, placements?: string) {
  if (!prior) return
  const previous = JSON.parse(prior.bytes.toString('utf8')) as {
    schemaVersion?: number; outfit?: number | string; form?: string; roles?: string[]; version?: string; manifest?: { sha256?: string };
    status?: 'withdrawn'; manifestSha256?: string; placements?: { sha256?: string }
  }
  if (previous?.schemaVersion !== 1 || previous.outfit !== source.outfit || previous.form !== source.form ||
    !/^v\d{3,6}$/.test(previous.version ?? '') ||
    !/^[a-f0-9]{64}$/.test(previous.status === 'withdrawn' ? previous.manifestSha256 ?? '' : previous.manifest?.sha256 ?? '')) {
    throw new Error('Malformed Platform combat sprite index for outfit ' + source.outfit)
  }
  const priorVersion = versionNumber(previous.version!)
  const approvedVersion = versionNumber(source.version)
  const priorManifest = previous.status === 'withdrawn' ? previous.manifestSha256 : previous.manifest?.sha256
  const sameVersion = priorVersion === approvedVersion
  if (source.status === 'withdrawn') {
    if (!sameVersion || priorManifest !== source.manifest) throw new GenerationConflict('Platform combat sprite no longer matches the withdrawal: ' + source.outfit)
  } else if (priorVersion > approvedVersion || (sameVersion &&
    (previous.status === 'withdrawn' || priorManifest !== source.manifest || previous.placements?.sha256 !== placements ||
      JSON.stringify(previous.roles) !== JSON.stringify(source.roles)))) {
    throw new GenerationConflict('Platform combat sprite already has this version or newer: ' + source.outfit)
  }
}

async function assertSelection(storage: ArtStorage, path: string, expected: StoredObject | null) {
  const current = await storage.read(path)
  if (expected ? !current || current.generation !== expected.generation || !current.bytes.equals(expected.bytes) : current) {
    throw new GenerationConflict(`Selection changed: ${path}`)
  }
}

async function select(storage: ArtStorage, path: string, bytes: Buffer, generation: string) {
  await storage.put(path, bytes, generation)
  const current = await storage.read(path)
  if (!current?.bytes.equals(bytes)) throw new Error(`Selection readback failed: ${path}`)
  return current
}

/** Stage each scoped actor and the merged game release before either pointer moves. */
export async function publishCombatSprites(storage: ArtStorage, platform: ArtStorage, selected: SelectedCampaign, sources: SourceIndex,
  options: { dryRun?: boolean; stageOnly?: boolean; stagedRelease?: string; campaign?: CampaignIdentity;
    report?: (stage: string, release: string) => Promise<void> } = {}) {
  if (options.campaign && options.campaign !== selected.campaign) throw new Error('Combat sprite destination does not match the selected campaign')
  const campaignPointer = CAMPAIGN_PREFIX + campaignPreviewIndex(selected.campaign)
  const refs = new Map((selected.release.combatSprites ?? []).map(row => [combatSpriteKey(row), row]))
  const casting = selected.book.story.casting
  const crew = new Set([...casting.crewOrder, ...casting.leads.map(lead => lead.outfit), ...(selected.book.recruits ?? []).map(recruit => recruit.outfit)])
  const heroines = new Set(casting.heroines.map(actor => actor.board))
  const plans = new Map<string, PlatformPlan>()
  await concurrent(sources.bundles, async source => {
    const key = combatSpriteKey(source)
    const identity = identityOf(source)
    const registered = typeof source.outfit === 'number' ? crew.has(source.outfit) : heroines.has(source.outfit)
    if (!registered && !refs.has(key)) throw new Error('Combat sprite outfit is outside the selected campaign: ' + source.outfit)
    const root = COMBAT_SPRITE_PREFIX + key + '/'
    const path = root + 'index.json'
    const prior = await platform.read(path)
    verifyPlatformVersion(prior, source, source.status === 'approved' ? source.placements : undefined)
    if (source.status === 'withdrawn') {
      const current = refs.get(key)
      if (current && current.manifest.sha256 !== source.manifest) throw new GenerationConflict('Campaign combat sprite no longer matches the withdrawal: ' + source.outfit)
      refs.delete(key)
      plans.set(key, { path, prior, bytes: encode({ schemaVersion: 1, ...identity, version: source.version,
        status: source.status, manifestSha256: source.manifest }) })
      return
    }
    const stage = await readCombatSprite(source.directory, source, true, identity)
    const { bundle, ref } = stage
    if (bundle.outfit !== source.outfit || bundle.character !== source.character || bundle.version !== source.version) {
      throw new Error('Combat sprite identity disagrees with producer approval: ' + source.character)
    }
    if (identity.form !== undefined) for (const fitting of heroineFittings(selected.book, identity)) {
      if (!bundle.fittings.some(row => row.id === fitting)) throw new Error(`Missing fixed encounter fitting: ${source.outfit}/${fitting}`)
    }
    const pages = new Map(source.pages.map(page => [page.file, page.sha256]))
    if (pages.size !== source.pages.length || pages.size !== ref.pages.length || ref.pages.some(page => pages.get(page.file) !== page.sha256)) {
      throw new Error('Combat sprite page pins disagree with producer approval: ' + source.character)
    }
    refs.set(key, ref)
    const platformRef = <T extends CampaignReleaseFile>(file: T): T => ({ ...file, path: root + file.path.split('/').at(-1)! })
    plans.set(key, { path, prior, payloads: stage.payloads, bytes: encode({ schemaVersion: 1, ...identity, version: source.version,
      manifest: platformRef(ref.manifest), placements: platformRef(ref.placements), pages: ref.pages.map(platformRef) }) })
  }, 4)
  const release = withCombatSprites(selected.release, refs)
  if (options.stagedRelease && release.release !== options.stagedRelease) {
    throw new GenerationConflict('The approved batch no longer produces the reviewed campaign release: ' + options.stagedRelease)
  }
  const manifest = encode(release)
  const campaignChanged = release !== selected.release
  const orderedPlans = sources.bundles.map(source => [source, plans.get(combatSpriteKey(source))!] as const)
  const platformChanges = orderedPlans.filter(([, plan]) => !plan.prior?.bytes.equals(plan.bytes))
  const result = { release: release.release, campaignChanged,
    platformChanges: platformChanges.map(([source]) => source.form === undefined ? source.outfit : combatSpriteKey(source)), promoted: false }
  if (options.dryRun) return { ...result, status: 'planned' }
  if (!campaignChanged && !platformChanges.length) return { ...result, status: 'unchanged' }

  await sources.assertCurrent()
  const platformPayloads = orderedPlans.flatMap(([source, plan]) => {
    const root = COMBAT_SPRITE_PREFIX + combatSpriteKey(source) + '/'
    return [...(plan.payloads ?? [])].map(([path, bytes]) => ({ path, platformPath: root + path.split('/').at(-1)!, bytes }))
  })
  if (!options.stagedRelease) await concurrent(platformPayloads, ({ platformPath, bytes }) => immutable(platform, platformPath, bytes))
  const checkStaged = async (store: ArtStorage, path: string, bytes: Buffer) => {
    if (!options.stagedRelease) return immutable(store, path, bytes)
    const remote = await store.read(path)
    if (!remote?.bytes.equals(bytes)) throw new Error('Staged sprite publication does not match: ' + path)
  }
  await concurrent(orderedPlans, async ([source, plan]) => {
    const root = COMBAT_SPRITE_PREFIX + combatSpriteKey(source) + '/'
    await checkStaged(platform, root + 'release.' + sha(plan.bytes) + '.json', plan.bytes)
  })
  await options.report?.('platform-staged', release.release)

  const gamePayloads = new Map<string, Buffer>()
  await concurrent(platformPayloads, async ({ path, platformPath, bytes }) => {
    const object = await platform.read(platformPath)
    if (!object?.bytes.equals(bytes)) throw new Error(`Platform combat sprite payload changed: ${path}`)
    gamePayloads.set(path, bytes)
  })
  await concurrent([...gamePayloads], ([path, bytes]) => checkStaged(storage, CAMPAIGN_PREFIX + path, bytes))
  if (campaignChanged || options.stagedRelease) await checkStaged(storage, CAMPAIGN_PREFIX + campaignReleasePath(release.release, selected.campaign), manifest)
  await options.report?.('campaign-staged', release.release)

  await sources.assertCurrent()
  await assertSelection(storage, campaignPointer, selected.pointer)
  await concurrent(orderedPlans, ([, plan]) => assertSelection(platform, plan.path, plan.prior))
  if (options.stageOnly) return { ...result, status: 'staged' }
  for (const [source, plan] of platformChanges) {
    await sources.assertCurrent()
    plan.prior = await select(platform, plan.path, plan.bytes, plan.prior?.generation ?? '0')
    await options.report?.(`platform-selected:${combatSpriteKey(source)}`, release.release)
  }

  await sources.assertCurrent()
  await concurrent(orderedPlans, ([, plan]) => assertSelection(platform, plan.path, plan.prior))
  if (campaignChanged) {
    await select(storage, campaignPointer, manifest, selected.pointer.generation)
    await options.report?.('campaign-selected', release.release)
  }
  return { ...result, status: 'selected', promoted: campaignChanged }
}
