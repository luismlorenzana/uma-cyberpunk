import { CABIN_STAGES, type CabinEvening, type CabinNight } from '../campaign-cabins'
import type { CampaignBook } from './campaign'
import { walkSteps } from './check'
import { P } from './parse'

function invitation(p: P, value: unknown, field: string): CabinEvening['invitation'] {
  const row = p.object(value, field, ['scene', 'stay', 'leave', 'wait', 'decline'], ['scene', 'stay', 'leave'])
  const result = { scene: p.slug(row.scene, `${field}.scene`), stay: p.int(row.stay, `${field}.stay`, 0, 5),
    leave: p.int(row.leave, `${field}.leave`, 0, 5), ...(row.wait === undefined ? {} : { wait: p.int(row.wait, `${field}.wait`, 0, 5) }),
    ...(row.decline === undefined ? {} : { decline: p.int(row.decline, `${field}.decline`, 0, 5) }) }
  const choices = [result.stay, result.leave, ...(result.wait === undefined ? [] : [result.wait]), ...(result.decline === undefined ? [] : [result.decline])]
  if (new Set(choices).size !== choices.length) p.fail(field, 'outcomes must use distinct choice indexes')
  return result
}

export function parseCabinEvenings(value: unknown, book: Pick<CampaignBook, 'dates' | 'pairs' | 'sectors' | 'scenes'>,
  reserved: ReadonlySet<string>): CabinEvening[] {
  const p = new P('campaign.json'), used = new Set(reserved), ids = new Set<string>(), sources = new Set<string>()
  return p.list(value, 'cabinEvenings', (value, field) => {
    const row = p.object(value, field, ['id', 'source', 'chats', 'invitation', 'bed', 'morning', 'changeMind', 'chatRapport'], ['id', 'source', 'chats', 'invitation', 'bed', 'morning', 'changeMind'])
    const id = p.slug(row.id, `${field}.id`)
    if (ids.has(id)) p.fail(field, 'duplicate cabin identity')
    ids.add(id)
    const src = p.object(row.source, `${field}.source`, ['companion', 'sector', 'pair'], [])
    if (Object.keys(src).length !== 1) p.fail(field, 'expected one companion, sector or pair')
    const source: CabinEvening['source'] = src.companion !== undefined ? { companion: p.outfit(src.companion, `${field}.source.companion`) }
      : src.sector !== undefined ? { sector: p.slug(src.sector, `${field}.source.sector`) } : { pair: p.slug(src.pair, `${field}.source.pair`) }
    const key = JSON.stringify(source)
    if (sources.has(key)) p.fail(field, 'duplicate cabin source')
    sources.add(key)
    const sector = 'sector' in source ? book.sectors?.find(s => s.id === source.sector) : undefined
    const pair = 'pair' in source ? book.pairs.find(s => s.id === source.pair) : undefined
    const actors = 'companion' in source ? [source.companion] : sector?.former && sector.shared ? [sector.officer, sector.former.speaker]
      : pair ? pair.members.map(m => m.outfit) : []
    if (!actors.length || 'companion' in source && !book.dates?.some(d => d.companion === source.companion)) p.fail(field, 'unknown cabin source')
    const own = new Set<string>()
    function scene(raw: unknown, path: string) {
      const id = p.slug(raw, path), scene = book.scenes.get(id)
      if (!scene || used.has(id) && !own.has(id)) return p.fail(path, 'unknown or already assigned cabin scene')
      if (!actors.every(actor => scene.cast.some(c => typeof actor === 'number' ? c.outfit === actor : c.heroine === actor))) p.fail(path, 'all participants must appear')
      for (const { step } of walkSteps(scene.steps, path)) {
        if (!['line', 'thought', 'narrate', 'emote', 'illustration', 'wait', 'choice', 'captain'].includes(step.kind)
          || step.kind === 'captain' && step.options.some(o => o.rapport !== 0)) p.fail(path, 'cabin scenes cannot grant effects, rapport or relationships')
      }
      own.add(id); used.add(id)
      return id
    }
    const rawChats = p.object(row.chats, `${field}.chats`, [...CABIN_STAGES])
    const chats = Object.fromEntries(CABIN_STAGES.map(stage => {
      const list = p.list(rawChats[stage], `${field}.chats.${stage}`, (v, path) => scene(v, path), 8)
      if (!list.length || new Set(list).size !== list.length) p.fail(field, 'expected distinct rotating chats')
      return [stage, list]
    })) as CabinEvening['chats']
    const invite = invitation(p, row.invitation, `${field}.invitation`)
    scene(invite.scene, `${field}.invitation.scene`)
    const script = book.scenes.get(invite.scene)!
    const choices = [...walkSteps(script.steps, field)].filter(s => s.step.kind === 'choice')
    const choice = script.steps.find(s => s.kind === 'choice')
    if (choices.length !== 1 || !choice || choice.options.length !== 2 + Number(invite.wait !== undefined) + Number(invite.decline !== undefined)
      || [invite.stay, invite.leave, ...(invite.wait === undefined ? [] : [invite.wait]), ...(invite.decline === undefined ? [] : [invite.decline])].some(i => !choice.options[i])) p.fail(field, 'invitation needs one top-level choice with every outcome mapped')
    const bed = p.list(row.bed, `${field}.bed`, (v, path) => scene(v, path), 8)
    if (!bed.length || new Set(bed).size !== bed.length) p.fail(field, 'expected distinct overnight scenes')
    const morning = p.object(row.morning, `${field}.morning`, ['stay', 'leave'])
    const phases = [invite.scene, ...bed, morning.stay, morning.leave, row.changeMind]
    if (new Set(phases).size !== phases.length || phases.some(id => Object.values(chats).flat().includes(String(id)))) p.fail(field, 'chat, invitation, bed, withdrawal and mornings need distinct scenes')
    const chatRapport = row.chatRapport === undefined ? 0 : p.int(row.chatRapport, `${field}.chatRapport`, 0, 250)
    if (!('companion' in source) && chatRapport) p.fail(field, 'shared visits cannot award an individual Captain bond')
    return { id, source, chatRapport, chats, invitation: invite, bed,
      morning: { stay: scene(morning.stay, `${field}.morning.stay`), leave: scene(morning.leave, `${field}.morning.leave`) },
      changeMind: scene(row.changeMind, `${field}.changeMind`) }
  }, 100)
}

/** Save v17 uses the same strict keys, without interpreting story configuration as save state. */
export function parseCabinNight(value: unknown): CabinNight {
  const p = new P('save'), row = p.object(value, 'cabin', ['kind', 'id', 'phase', 'scene', 'round', 'outcome', 'choice', 'plan'])
  if (row.kind !== 'cabin' || !['chat', 'invitation', 'bed', 'leave', 'morning'].includes(String(row.phase))) p.fail('cabin', 'unknown cabin phase')
  if (row.outcome !== null && row.outcome !== 'stay' && row.outcome !== 'leave') p.fail('cabin.outcome', 'unknown night outcome')
  const plan = p.object(row.plan, 'cabin.plan', ['invitation', 'bed', 'morning', 'changeMind', 'location', 'rapport'])
  if (plan.location !== 'aboard' && plan.location !== 'ashore') p.fail('cabin.plan.location', 'expected aboard or ashore')
  const morning = p.object(plan.morning, 'cabin.plan.morning', ['stay', 'leave'])
  const reward = plan.rapport === null ? null : p.object(plan.rapport, 'cabin.plan.rapport', ['companion', 'amount'])
  const result: CabinNight = { kind: 'cabin', id: p.slug(row.id, 'cabin.id'), phase: row.phase as CabinNight['phase'],
    scene: p.slug(row.scene, 'cabin.scene'), round: p.int(row.round, 'cabin.round', 0, 1000000), outcome: row.outcome as CabinNight['outcome'],
    choice: row.choice === null ? null : p.int(row.choice, 'cabin.choice', 0, 5),
    plan: { location: plan.location as 'aboard' | 'ashore', rapport: reward ? { companion: p.outfit(reward.companion, 'cabin.plan.rapport.companion'), amount: p.int(reward.amount, 'cabin.plan.rapport.amount', 0, 250) } : null,
      invitation: plan.invitation === null ? null : invitation(p, plan.invitation, 'cabin.plan.invitation'),
      bed: p.slug(plan.bed, 'cabin.plan.bed'), changeMind: p.slug(plan.changeMind, 'cabin.plan.changeMind'),
      morning: { stay: p.slug(morning.stay, 'cabin.plan.morning.stay'), leave: p.slug(morning.leave, 'cabin.plan.morning.leave') } } }
  const expected = result.phase === 'invitation' ? result.plan.invitation?.scene : result.phase === 'bed' ? result.plan.bed
    : result.phase === 'leave' ? result.plan.changeMind : result.phase === 'morning' && result.outcome ? result.plan.morning[result.outcome] : result.scene
  if (expected !== result.scene || result.phase === 'chat' && result.outcome !== null || result.phase === 'bed' && result.outcome !== 'stay'
    || result.phase === 'leave' && result.outcome !== 'leave' || result.phase === 'morning' && !result.outcome
    || result.outcome === 'stay' && (!result.plan.invitation || result.choice !== result.plan.invitation.stay)
    || !result.outcome && result.choice !== null
    || result.phase === 'invitation' && result.outcome === 'leave' && result.choice !== result.plan.invitation?.leave && result.choice !== result.plan.invitation?.decline) p.fail('cabin', 'phase, scene and outcome do not agree')
  return result
}
