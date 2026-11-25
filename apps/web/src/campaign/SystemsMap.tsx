import { campaignJourney, developedPort, jumpRoute, storesAt, type CampaignBook, type CampaignSupply, type Save } from '@cyber/domain'
import { useState } from 'react'
import { CampaignThumbnail } from './CampaignThumbnail'
import { campaignControl } from './CampaignQuestRow'
import { type LoadedCampaign } from './load'
import { questComplete } from './quests'

export function SystemsMap({ book, assets, save, stock, drives, travel, open, locate, destination }: {
  book: CampaignBook; assets: LoadedCampaign['assets']; save: Save; stock: CampaignSupply; drives: readonly string[]
  travel: (destination: string) => void; open?: (quest: string) => void; locate?: () => void; destination?: string
}) {
  const systems = [...book.fourAct!.systems.values()]
  const network = book.supply!
  const index = new Map(book.quests.map(quest => [quest.id, quest]))
  const complete = (id?: string) => {
    const quest = id ? index.get(id) : undefined
    return !!quest && questComplete(save, quest, book)
  }
  const groups = systems.map(system => {
    const duos = [...book.fourAct!.duos.values()].filter(duo => duo.system === system.id)
    const ids = [...duos.flatMap(row => row.local ? [row.local.base, row.local.evidence] : []), system.capital?.operation, system.capital?.settlement]
    const authoredPorts = new Set(ids.flatMap(id => id && index.get(id)?.port || []))
    for (const arc of book.fourAct!.arcs.values()) if (arc.system === system.id) {
      const recruit = book.recruits?.find(row => row.outfit === arc.outfit)
      const landing = recruit && index.get(recruit.signOn)?.port
      if (landing) authoredPorts.add(landing)
    }
    return { id: system.id, ports: network.ports.filter(row => authoredPorts.has(row.id)), duos, capital: system.capital }
  })
  const frontier = network.ports.filter(row => groups.every(group => !group.ports.includes(row)))
  const [area, setArea] = useState(() => groups.find(group => group.ports.some(port => port.id === (destination ?? stock.port)))?.id ?? 'frontier')
  const group = groups.find(group => group.id === area)
  const ports = group?.ports ?? frontier
  const [selected, select] = useState(destination)
  const port = ports.find(port => port.id === selected) ?? ports.find(port => port.id === stock.port) ?? ports[0]
  const stockAtPort = port ? storesAt(stock, developedPort(book, save, port)) : null
  const journey = port && campaignJourney(network, stock.port, port.id, drives, save.story.flags)
  const leg = port && journey && network.routes.find(route => route.from === stock.port && route.to === journey.first
    || route.to === stock.port && route.from === journey.first)
  const canJump = leg && jumpRoute(stock, leg, drives, save.story.flags) !== stock
  const approach = port && book.art.find(art => art.scene === port.scene)?.backdrop
  const landingArt = (approach ? assets.get(approach) : undefined) ?? assets.get('rainward-relief-receiving-dock')
  const settlement = group?.capital?.settlement
  const stage = settlement ? index.get(complete(group?.capital?.operation) ? settlement : group!.capital!.operation) : undefined
  const label = (id: string) => network.ports.find(row => row.id === id)?.name ?? id
  return <div className="space-y-3" aria-label="Home systems">
    <div className="flex flex-wrap gap-2">
      {[...groups.map(row => row.id), 'frontier'].map(id => <button key={id} type="button"
        className={campaignControl + ' capitalize aria-pressed:ring-2 aria-pressed:ring-cyan-300'} aria-pressed={id === area}
        onClick={() => { setArea(id); select(undefined) }}>{id === 'frontier' ? 'Frontier and return ports' : id.replaceAll('-', ' ')}</button>)}
    </div>
    {group && <p className="text-sm text-slate-200">
      {complete(settlement) ? 'Capital liberated' : 'Capital contested'} · {group.duos.filter(row => complete(row.local?.base)).length}/{group.duos.filter(row => row.local).length} liberation bases open
    </p>}
    <div className="flex flex-wrap gap-2" aria-label="Landing ports">{ports.map(row => <button key={row.id} type="button"
      aria-pressed={port?.id === row.id} className={campaignControl + ' aria-pressed:ring-2 aria-pressed:ring-cyan-300'}
      onClick={() => select(row.id)}>{row.name}{row.id === stock.port ? ' · Docked' : ''}</button>)}</div>
    {port && stockAtPort && <article className="space-y-2 rounded-lg bg-[#101e32] p-3">
      {landingArt && <CampaignThumbnail asset={landingArt} className="h-32 w-full rounded-lg object-cover" />}
      <h3 className="font-semibold">{port.name}</h3>
      <p className="text-sm">Stores · {stockAtPort.fuel} fuel · {stockAtPort.provisions} provisions · {stockAtPort.alloy} alloy</p>
      {port.id === stock.port ? locate && <button type="button" className={campaignControl} onClick={locate}>Inspect landing</button>
        : journey && leg ? <>
          <p className="text-sm">{journey.fuel} fuel total · {leg.fuel} for next jump to {label(journey.first)}</p>
          <button type="button" disabled={!canJump} className={campaignControl + ' disabled:opacity-50'}
            onClick={() => travel(port.id)}>Jump to {label(journey.first)}</button>
        </> : <p className="text-sm">Route locked · check clearance and drive capability.</p>}
      {stage && !complete(settlement) && stage.port === port.id && <p className="text-sm">Capital operation · {stage.title}</p>}
      {group?.duos.flatMap(duo => {
        const base = duo.local && index.get(duo.local.base)
        return base && base.port === port.id && complete(base.id) ? [<p key={base.id} className="text-sm">{base.title} · Active</p>] : []
      })}
      {port.id === stock.port && stage && stage.port === port.id && open && !complete(settlement)
        && <button type="button" className={campaignControl} onClick={() => open(stage.id)}>Check capital operation</button>}
      <details><summary className="min-h-11 min-w-11 cursor-pointer py-2 text-sm">Route connections</summary><ul className="space-y-1 text-sm">
        {network.routes.filter(route => route.from === port.id || route.to === port.id).map(route => {
          const to = route.from === port.id ? route.to : route.from
          return <li key={to}>{label(to)} · {route.fuel} fuel{route.flag && !save.story.flags.includes(route.flag)
            ? ' · Awaiting clearance' : route.needs && !drives.includes(route.needs) ? ' · Drive upgrade required' : ''}</li>
        })}
      </ul></details>
    </article>}
  </div>
}
