import { LOCATION_STATES, MANAGEMENT_EVENTS, type CampaignManagement, type ManagementEntry, type ManagementLocation, type LocationVisual } from '../campaign-management'
import { PARTS_BY_ID } from '../crew/parts'
import { MODULE_IDS, type ModuleId } from '../ship/modules'
import type { CampaignBook } from './campaign'
import { walkSteps } from './check'
import { P } from './parse'

/** Locations and receipts describe existing actions. Their dialogue cannot grant state or start a mission. */
export function parseCampaignManagement(value: unknown, book: Pick<CampaignBook, 'quests' | 'projects' | 'scenes' | 'assets' | 'workshop'>): CampaignManagement {
  const p = new P('campaign.json')
  const root = p.object(value, 'management', ['after', 'locations', 'reports'])
  const quests = new Set(book.quests.map(({ id }) => id)), assets = new Set(book.assets.map(({ id }) => id))
  const slugIn = (value: unknown, field: string, known: ReadonlySet<string>) => {
    const id = p.slug(value, field)
    if (!known.has(id)) p.fail(field, `unknown reference ${id}`)
    return id
  }
  const scene = (value: unknown, field: string, fallback = false) => {
    const id = slugIn(value, field, new Set(book.scenes.keys()))
    for (const { step } of walkSteps(book.scenes.get(id)!.steps, '')) {
      if (!['line', 'narrate', 'thought', 'emote', 'illustration', 'wait', 'choice'].includes(step.kind)) p.fail(field, 'management context must have no game effects, paths, calls or battles')
      const speaker = 'speaker' in step ? step.speaker : 'actor' in step ? step.actor : undefined
      if (fallback && speaker !== undefined && speaker !== 'steward') p.fail(field, 'universal fallback must use Steward or narration')
    }
    return id
  }
  const visual = (value: unknown, field: string): LocationVisual => {
    const row = p.object(value, field, ['slot', 'asset', 'fallback'], ['slot', 'fallback'])
    return { slot: p.slug(row.slot, `${field}.slot`), fallback: slugIn(row.fallback, `${field}.fallback`, assets),
      ...(row.asset === undefined ? {} : { asset: slugIn(row.asset, `${field}.asset`, assets) }) }
  }
  const locations = p.list(root.locations, 'management.locations', (value, field): ManagementLocation => {
    const row = p.object(value, field, ['id', 'title', 'family', 'entry', 'scene', 'visual', 'states', 'prop', 'props', 'contexts'], ['id', 'title', 'family', 'entry', 'scene', 'visual', 'states'])
    const family = row.family as ManagementLocation['family']
    if (!['command', 'living', 'social', 'care', 'operations', 'planet'].includes(family)) p.fail(`${field}.family`, 'unknown location family')
    const gate = p.object(row.entry, `${field}.entry`, ['kind', 'module', 'quest', 'project'], ['kind'])
    const kind = gate.kind as ManagementEntry['kind']
    let entry: ManagementEntry
    const expected = kind === 'module' ? 'module' : kind === 'quest' ? 'quest' : kind === 'project' ? 'project' : undefined
    if (Object.keys(gate).length !== (expected ? 2 : 1)) p.fail(`${field}.entry`, 'expected only the gate and its target')
    if (kind === 'module') entry = { kind, module: slugIn(gate.module, `${field}.entry.module`, new Set(MODULE_IDS)) as ModuleId }
    else if (kind === 'quest') entry = { kind, quest: slugIn(gate.quest, `${field}.entry.quest`, quests) }
    else if (kind === 'project') entry = { kind, project: slugIn(gate.project, `${field}.entry.project`, new Set(book.projects?.map(({ id }) => id))) }
    else if (['workshop', 'port', 'command', 'custody', 'shared'].includes(kind)) {
      if (kind === 'workshop' && !book.workshop) p.fail(field, 'workshop entry needs the existing workshop')
      entry = { kind } as ManagementEntry
    } else return p.fail(`${field}.entry.kind`, 'unknown saved-state gate')
    const states = p.object(row.states, `${field}.states`, [...LOCATION_STATES], [])
    const parseProp = (value: unknown) => {
      const prop = p.object(value, `${field}.prop`, ['asset', 'when', 'resource', 'x', 'y', 'width', 'height'], ['asset', 'when', 'x', 'y', 'width', 'height'])
      const when = prop.when as NonNullable<ManagementLocation['prop']>['when']
      if (!['hangar-alloy', 'ship-alloy', 'port-surplus', 'ship-stock'].includes(when)) p.fail(`${field}.prop.when`, 'expected a saved stock predicate')
      const resource = prop.resource as 'fuel' | 'provisions' | 'alloy' | undefined
      if (resource !== undefined && !['fuel', 'provisions', 'alloy'].includes(resource)) p.fail(field, 'unknown prop resource')
      if ((when === 'ship-stock' && !resource) || ((when === 'ship-alloy' || when === 'hangar-alloy') && resource && resource !== 'alloy')) p.fail(field, 'resource differs from its stock predicate')
      const width = p.int(prop.width, `${field}.prop.width`, 1, 1844), height = p.int(prop.height, `${field}.prop.height`, 1, 853)
      return { asset: slugIn(prop.asset, `${field}.prop.asset`, assets), when, ...(resource ? { resource } : {}),
        x: p.int(prop.x, `${field}.prop.x`, 0, 1844 - width), y: p.int(prop.y, `${field}.prop.y`, 0, 853 - height), width, height }
    }
    if (row.prop !== undefined && row.props !== undefined) p.fail(field, 'use prop or props, not both')
    const prop = row.prop === undefined ? undefined : parseProp(row.prop)
    const props = row.props === undefined ? undefined : p.list(row.props, field + '.props', parseProp, 3)
    if (props && new Set(props.map(row => row.asset)).size !== props.length) p.fail(field, 'duplicate prop')
    const contexts = row.contexts === undefined ? undefined : p.list(row.contexts, field + '.contexts', (value, path) => {
      const context = p.object(value, path, ['state', 'scene', 'fallback'])
      const state = context.state as typeof LOCATION_STATES[number]
      if (!LOCATION_STATES.includes(state)) p.fail(path, 'unknown context state')
      return { state, scene: scene(context.scene, path + '.scene'), fallback: scene(context.fallback, path + '.fallback', true) }
    }, 9)
    if (contexts && new Set(contexts.map(x => x.state)).size !== contexts.length) p.fail(field, 'duplicate context state')
    return { id: p.slug(row.id, `${field}.id`), title: p.text(row.title, `${field}.title`, 48), family, entry,
      scene: scene(row.scene, `${field}.scene`, true), visual: visual(row.visual, `${field}.visual`),
      states: Object.fromEntries(Object.entries(states).map(([key, value]) => [key, visual(value, `${field}.states.${key}`)])), ...(prop ? { prop } : {}), ...(props ? { props } : {}), ...(contexts ? { contexts } : {}) }
  }, 64)
  const ids = new Set(locations.map(({ id }) => id))
  if (ids.size !== locations.length) p.fail('management.locations', 'duplicate location')
  const reports = p.list(root.reports, 'management.reports', (value, field) => {
    const row = p.object(value, field, ['kind', 'subject', 'destination', 'location', 'scene', 'fallback'], ['kind', 'location', 'scene', 'fallback'])
    const kind = row.kind as CampaignManagement['reports'][number]['kind']
    if (!MANAGEMENT_EVENTS.includes(kind)) p.fail(`${field}.kind`, 'unknown receipt kind')
    const subject = row.subject === undefined ? undefined : p.slug(row.subject, field + '.subject')
    if (subject && ((kind.startsWith('project-') && !book.projects?.some(project => project.id === subject))
      || (kind.startsWith('refit-') && !MODULE_IDS.includes(subject as ModuleId))
      || ((kind === 'crafted' || kind === 'fitted') && !PARTS_BY_ID.has(subject))
      || (kind === 'shipment' && !['fuel', 'provisions', 'alloy'].includes(subject)))) p.fail(field + '.subject', 'unknown transaction target')
    const destination = row.destination as 'ship' | 'hangar' | 'port' | undefined
    if (destination !== undefined && !['ship', 'hangar', 'port'].includes(destination)) p.fail(field, 'unknown receipt destination')
    return { kind, ...(subject ? { subject } : {}), ...(destination ? { destination } : {}),
      location: slugIn(row.location, `${field}.location`, ids), scene: scene(row.scene, `${field}.scene`), fallback: scene(row.fallback, `${field}.fallback`, true) }
  }, 128)
  const keys = reports.map(({ kind, subject, destination }) => `${kind}:${subject ?? '*'}:${destination ?? '*'}`)
  if (new Set(keys).size !== keys.length) p.fail('management.reports', 'duplicate report binding')
  return { after: slugIn(root.after, 'management.after', quests), locations, reports }
}
