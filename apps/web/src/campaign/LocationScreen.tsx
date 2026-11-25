import { campaignSupport, campaignUpkeep, MODULES_BY_ID, PARTS_BY_ID, type ModuleId, type ManagementLocation, type LocationProp, type ManagementReceipt, type Save } from '@cyber/domain'
import { useEffect, useState } from 'react'
import { updateSave } from '../save/game'
import { nameOf } from '../story/runner'
import { CampaignScene } from './CampaignScene'
import { campaignImage, type LoadedCampaign } from './load'
import { acknowledgeManagement, locationContext, locationLedger, visibleLocationProps, locationState, managementAt, managementReports } from './management'
import { ProjectsPanel } from './ProjectsPanel'
import { SectorPanel } from './SectorPanel'
import { SupplyPanel } from './SupplyPanel'
import WorkshopPanel from './WorkshopPanel'

const button = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-[#111a2d]/95 px-3 text-sm font-semibold text-white ring-1 ring-white/20 disabled:opacity-50'
const reportNames = { shipment: 'Shipment receipt', relief: 'Relief delivery', 'project-start': 'Work order', 'project-complete': 'Completion report', 'refit-start': 'Refit order', 'refit-complete': 'Refit report', crafted: 'Workshop report', fitted: 'Fitting check' }
const states = { ready: 'Ready', unfunded: 'Awaiting funding', building: 'Work in progress', complete: 'Operational', stocked: 'Cargo aboard', fitted: 'Equipment fitted', occupied: 'Occupied', restored: 'Civilian control', powered: 'Powered' }

function receiptSubject(event: ManagementReceipt, loaded: LoadedCampaign) {
  const subject = PARTS_BY_ID.get(event.subject)?.name ?? MODULES_BY_ID.get(event.subject as ModuleId)?.name
    ?? loaded.book.projects?.find(({ id }) => id === event.subject)?.title ?? event.subject.replaceAll('-', ' ')
  return subject
}

function receiptLabel(event: ManagementReceipt, loaded: LoadedCampaign) {
  const subject = receiptSubject(event, loaded), officer = event.officer ? ` · ${nameOf(loaded.book.story, event.officer)}` : ''
  return `Day ${event.day} · ${event.kind.replaceAll('-', ' ')} · ${subject}${event.kind === 'shipment' ? ` × ${event.amount} → ${event.destination === 'hangar' ? 'Hangar' : 'ship cargo'}` : ''}${officer}`
}

function LocationArt({ loaded, location, state, props }: { loaded: LoadedCampaign; location: ManagementLocation; state: ReturnType<typeof locationState>; props: LocationProp[] }) {
  const visual = location.states[state] ?? location.visual, keys = props.map(prop => prop.asset).join(':')
  const [images, setImages] = useState<{ plate?: string; props: Record<string, string> }>({ props: {} })
  useEffect(() => {
    let live = true
    const urls: string[] = []
    setImages({ props: {} })
    const read = async (id: string) => {
      const ref = loaded.assets.get(id)
      if (!ref) throw new Error('Missing room asset')
      const url = await campaignImage(ref)
      if (live) urls.push(url); else URL.revokeObjectURL(url)
      return url
    }
    const plate = visual.asset ? read(visual.asset).catch(() => read(visual.fallback)) : read(visual.fallback)
    void Promise.all([plate.catch(() => undefined), Promise.all(props.map(async prop => {
      try { return [[prop.asset, await read(prop.asset)]] as [string, string][] } catch { return [] }
    }))]).then(([plate, props]) => { if (live) setImages({ plate, props: Object.fromEntries(props.flat()) }) })
    return () => { live = false; urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [loaded, visual, keys])
  return <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#10182a]" aria-hidden="true">
    <div className="absolute left-0 top-1/2 w-full -translate-y-1/2" style={{ aspectRatio: '1844 / 853' }}>
      {images.plate && <img src={images.plate} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />}
      {props.map(prop => images.props[prop.asset] && <img key={prop.asset} src={images.props[prop.asset]} alt="" data-location-prop={prop.asset} className="absolute object-contain" style={{
        left: `${prop.x / 1844 * 100}%`, top: `${prop.y / 853 * 100}%`,
        width: `${prop.width / 1844 * 100}%`, height: `${prop.height / 853 * 100}%`,
      }} />)}
    </div>
  </div>
}

export default function LocationScreen({ save, loaded, location, back, error }: {
  save: Save; loaded: LoadedCampaign; location: ManagementLocation; back: () => void; error: string | null
}) {
  const [scene, setScene] = useState<{ id: string; key: string } | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const at = managementAt(save, loaded.book)!
  const state = locationState(save, loaded.book, location)
  const reports = managementReports(save, loaded.book, location)
  const entry = location.entry
  const cargo = ['cargo-hold', 'airlock', 'bridge'].includes(location.id)
  const contextScene = locationContext(save, loaded.book, location)
  const context = `location:${contextScene}`
  // A pack swap may retire a context scene. Its read-only conversation can always be left.
  if (scene && loaded.book.scenes.has(scene.id)) return <CampaignScene key={`${loaded.release.release}:${scene.id}`} loaded={loaded} sceneId={scene.id}
    placeLabel={location.title} exitLabel="Back to room" fail={message => { setFailure(message); setScene(null) }} onExit={() => setScene(null)} finish={() => {
      void updateSave(current => scene.key.startsWith('location:') || managementReports(current, loaded.book, location).some(report => report.key === scene.key)
        ? acknowledgeManagement(current, scene.key) : current).then(() => setScene(null), error => { setFailure(String(error)); setScene(null) })
    }} />
  return <main className="absolute inset-0 overflow-hidden bg-[#0b0d17] text-[#e8ebf5]" style={{ margin: 'var(--inset-top) var(--inset-right) var(--inset-bottom) var(--inset-left)' }}>
    <LocationArt loaded={loaded} location={location} state={state} props={visibleLocationProps(save, loaded.book, location)} />
    <div className="relative grid h-full grid-rows-[auto_1fr] gap-2 p-2">
      <header className="flex min-w-0 items-center gap-2">
        <button type="button" className={button} onClick={back}>Campaign</button>
        <h1 className="min-w-0 flex-1 rounded-lg bg-[#0b0d17]/85 px-2 font-display text-lg font-bold">{location.title}</h1>
      </header>
      <div className="grid min-h-0 grid-cols-[0.9fr_1fr] gap-3">
        <section className="flex min-h-0 flex-col items-start justify-between gap-2 overflow-y-auto" aria-label="Location state">
          <div className="space-y-2">
            <p className="inline-block rounded-lg bg-[#0b0d17]/95 px-3 py-2 text-sm font-bold" data-location-state={state}>{states[state]}</p>
            <button type="button" className={`${button} block`} onClick={() => setScene({ id: contextScene, key: context })}>
              {save.management.acknowledged.includes(context) ? 'Look around again' : 'Look around'}
            </button>
            {reports.map(report => <button key={report.key} type="button" className={`${button} block text-left`} onClick={() => setScene({ id: report.scene, key: report.key })}>
              {reportNames[report.event.kind]} · {receiptSubject(report.event, loaded)}
            </button>)}
          </div>
          <div className="space-y-1 rounded-lg bg-[#0b0d17]/90 p-2 text-xs">
            {locationLedger(save, loaded.book, location).map(line => <p key={line}>{line}</p>)}
            <p className="text-white/60" data-campaign-release>{loaded.release.release}</p>
            {(error || failure) && <p role="alert" className="text-[#ffa7b7]">{error || failure}</p>}
          </div>
        </section>
        <div className="min-h-0 space-y-2 overflow-y-auto rounded-xl bg-[#0b0d17]/95 p-2" aria-label="Location controls">
          {cargo && <SupplyPanel save={save} network={loaded.book.supply!} supply={at.supply} port={at.port} worlds={loaded.book.story.worlds}
            upkeep={campaignUpkeep(loaded.book, save, campaignSupport(loaded.book, save).ashore)} />}
          {entry.kind === 'workshop' && <WorkshopPanel save={save} loaded={loaded} ashore={campaignSupport(loaded.book, save).ashore} />}
          {(entry.kind === 'project' || entry.kind === 'command' || (entry.kind === 'module' && entry.module === 'engineering')) &&
            <ProjectsPanel book={loaded.book} save={save} port={at.port} onlyProject={entry.kind === 'project' ? entry.project : undefined}
              refitsOnly={entry.kind === 'module'} />}
          {(entry.kind === 'command' || entry.kind === 'custody') && <SectorPanel book={loaded.book} save={save} />}
          {!cargo && entry.kind !== 'workshop' && <p className="text-sm">Ship cargo · {at.supply.fuel} Fuel · {at.supply.provisions} Provisions · {save.wallet.alloy} Alloy</p>}
          <section aria-label="Recent management receipts" className="space-y-2 text-sm">
            <h2 className="font-semibold">Recent work</h2>
            {save.management.receipts.slice(-4).reverse().map(event => <p key={event.sequence}>{receiptLabel(event, loaded)}</p>)}
            {!save.management.receipts.length && <p>No transfers or work recorded yet.</p>}
          </section>
        </div>
      </div>
    </div>
  </main>
}
