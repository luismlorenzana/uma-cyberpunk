import { observeManagement, assignPost, awayMembers, campaignSupport, freePlace, fundPortProject, installedSystems, moduleAt, MODULES_BY_ID, placeModule, placeProblem, powerChoice,
  portProjectOpen, shipPosts, startSupply, SUPPLY_KINDS, upgradeModule, upgradeProblem, type CampaignBook, type Save, type SupplyPort } from '@cyber/domain'
import { updateSave } from '../save/game'
import { nameOf } from '../story/runner'

const button = 'min-h-11 rounded-lg bg-white/10 px-3 text-sm disabled:opacity-50'
const refits = ['engines', 'engineering', 'hangar', 'quarters'] as const

export function ProjectsPanel({ book, save, port, onlyProject, refitsOnly, showReport, expanded }: { book: CampaignBook; save: Save; port: SupplyPort; onlyProject?: string; refitsOnly?: boolean; showReport?: (scene: string) => void; expanded?: boolean }) {
  const projects = book.projects?.filter(project => !refitsOnly && (!onlyProject || onlyProject === project.id)
    && portProjectOpen(book, save, project, port.id)) ?? []
  const crew = save.crew.filter(({ outfit, expeditionOnly }) => !expeditionOnly && !campaignSupport(book, save).ashore.has(outfit))
  const away = new Set(awayMembers(save.operations, save.squads))
  const posts = shipPosts(save.ship).filter(({ module }) => module === 'engineering' || module === 'hangar' || module === 'log')
  function change(change: (save: Save) => Save) {
    void updateSave((current) => {
      const stock = current.campaignSupply ?? (book.supply ? startSupply(book.supply) : undefined)
      if (!stock || stock.port !== port.id || current.expedition || current.mission || current.pairScene || current.campaignDay.pending) return current
      const selected = change(current)
      return selected === current ? current : observeManagement(current, { ...selected, campaignSupply: selected.campaignSupply ?? stock })
    })
  }
  return <section aria-label="Projects and refits" className="space-y-3 rounded-xl border border-white/15 bg-white/5 p-3">
    {projects.length > 0 && <div className="space-y-2">
      <h2 className="font-display text-lg font-bold">Port projects</h2>
      {projects.map((project) => {
        const left = save.campaignProjects[project.id]
        const report = project.base?.scenes[left === 0 ? (save.story.seen.includes(project.base.scenes.open) ? 'visit' : 'open')
          : left === project.days ? 'funded' : left === undefined ? (save.wallet.alloy < project.alloy ? 'shortfall' : 'look') : 'funded']
        const canHear = report && (left === undefined || left === 0 || left === project.days)
          && book.scenes.get(report)?.cast.every(({ outfit }) => outfit === undefined
            || crew.some(member => member.outfit === outfit) && !away.has(outfit))
        return <div key={project.id} className="space-y-1 text-sm">
          <p className="font-semibold">{project.title}</p>
          <p>{SUPPLY_KINDS.flatMap((kind) => project.production[kind] || project.upkeep[kind]
            ? [`${kind} +${project.production[kind]} · upkeep ${project.upkeep[kind]}`] : []).join(' / ')} per night</p>
          {project.sector && <p>{book.sectors?.find(({ id }) => id === project.sector)?.title} crew</p>}
          {report && canHear && showReport && <button type="button" className={button} onClick={() => showReport(report)}>Project report</button>}
          {left === undefined ? <button type="button" className={button} disabled={save.wallet.alloy < project.alloy}
            onClick={() => change((current) => fundPortProject(current, book, project))}>Fund · {project.alloy} Alloy · {project.days} nights</button>
            : <p>{left ? `${left} nights left` : 'Operating'}</p>}
        </div>
      })}
    </div>}
    {!onlyProject && <details open={expanded}>
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">Ship refits and duties</summary>
      <div className="space-y-2 text-sm">
        {refits.flatMap((id) => {
          const module = moduleAt(save.ship, id)
          if (!module) return []
          const definition = MODULES_BY_ID.get(id)!
          const next = definition.levels[module.level]
          return <div key={id} className="flex items-center justify-between gap-2">
            <p>{definition.name} {module.level}{module.building && ` · ${module.building.left} nights left`}</p>
            {next && !module.building && <button type="button" className={button} disabled={!!upgradeProblem(save.ship, save.wallet, id)}
              onClick={() => change((current) => { const result = upgradeModule(current.ship, current.wallet, id); return result ? { ...current, ...result } : current })}>
              Refit · {next.cost.credits} cr · {next.cost.alloy} Alloy · {next.cost.data} Data
            </button>}
          </div>
        })}
        <div className="flex flex-wrap gap-2">
          {(['sensors', 'battery'] as const).flatMap((id) => {
            if (moduleAt(save.ship, id)) return []
            const slot = freePlace(save.ship, id)
            const cost = MODULES_BY_ID.get(id)!.levels[0].cost
            return <button key={id} type="button" className={button} disabled={!slot || !!placeProblem(save.ship, save.wallet, id, slot.deck, slot.slot)}
              onClick={() => change((current) => {
                const target = freePlace(current.ship, id)
                const result = target && placeModule(current.ship, current.wallet, id, target.deck, target.slot)
                return result ? { ...current, ...result } : current
              })}>Install {MODULES_BY_ID.get(id)!.name} · {cost.credits} cr · {cost.alloy} Alloy · {cost.data} Data</button>
          })}
          {installedSystems(save.ship).map((id) => <button key={id} type="button" className={button} aria-pressed={save.ship.powered.includes(id)}
            onClick={() => change((current) => {
              const running = current.ship.powered
              const powered = powerChoice(current.ship, running.includes(id) ? running.filter((system) => system !== id) : [...running, id])
              return powered ? { ...current, ship: { ...current.ship, powered } } : current
            })}>{MODULES_BY_ID.get(id)!.name} · {save.ship.powered.includes(id) ? 'Powered' : 'Off'}</button>)}
        </div>
        {posts.map((post) => {
          const held = crew.find(({ post: assignment }) => assignment?.module === post.module && assignment.index === post.index)
          return <label key={`${post.module}:${post.index}`} className="flex items-center justify-between gap-2 capitalize">
            {post.kind}
            <select className="min-h-11 rounded-lg bg-[#182238] px-2" value={held?.outfit ?? ''} onChange={(event) => {
              const selection = Number(event.currentTarget.value)
              change((current) => {
                if (!selection) {
                  const holder = current.crew.find(({ post: assigned }) => assigned?.module === post.module && assigned.index === post.index)
                  return holder ? assignPost(current, holder.outfit, null) : current
                }
                return current.crew.some(({ outfit }) => outfit === selection) && !campaignSupport(book, current).ashore.has(selection)
                  ? assignPost(current, selection, post) : current
              })
            }}>
              <option value="">Unassigned</option>
              {crew.map(({ outfit }) => <option key={outfit} value={outfit}>{nameOf(book.story, outfit)}</option>)}
            </select>
          </label>
        })}
      </div>
    </details>}
  </section>
}
