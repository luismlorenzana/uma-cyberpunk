import { observeManagement } from './campaign-management'
import { campaignSupport, formerDisposition, sectorAppointed } from './campaign-sectors'
import { SHIP_PROVISIONS_PER_NIGHT, type Supplies, type SupplyPort } from './campaign-supply'
import type { Save } from './save/save'
import type { CampaignBook } from './story/campaign'

interface ProjectTerms {
  id: string
  title: string
  alloy: number
  days: number
  production: Supplies
  upkeep: Supplies
}

export const BASE_PROJECT_SCENES = ['look', 'shortfall', 'funded', 'open', 'visit'] as const
type BaseProjectScene = typeof BASE_PROJECT_SCENES[number]

export type PortProject = ProjectTerms & (
  { sector: string; base?: never } |
  { sector?: never; base: { quest: string; port: string; scenes: Record<BaseProjectScene, string> } }
)

function projectPort(book: CampaignBook, project: PortProject) {
  return project.base?.port ?? book.sectors?.find(({ id }) => id === project.sector)?.port
}

export function portProjectOpen(book: CampaignBook, save: Pick<Save, 'story'>, project: PortProject, port: string) {
  if (projectPort(book, project) !== port) return false
  if (project.base) {
    const quest = book.quests.find(q => q.id === project.base?.quest)
    return !!quest && save.story.seen.includes(quest.scene)
  }
  const sector = book.sectors?.find(({ id }) => id === project.sector)
  return !!sector && sectorAppointed(book, save.story, sector)
}

export const projectCompleteFlag = (id: string): string => `project-ready-${id}`

export function campaignUpkeep(book: CampaignBook, save: Save, ashore: ReadonlySet<number>): number {
  if (!book.projects?.some(project => project.sector)) return campaignSupport(book, save).provisions
  const aboard = save.crew.filter(({ outfit }) => !ashore.has(outfit)).length
  const holding = (book.sectors ?? []).some((sector) => sector.port === save.campaignSupply?.port && formerDisposition(book, save.story, sector) === 'Awaiting review')
  const systems = save.ship.powered.length
  return SHIP_PROVISIONS_PER_NIGHT + Math.ceil(aboard / 4) + Number(holding) + Math.ceil(systems / 2)
}

export function developedPort(book: CampaignBook, save: Pick<Save, 'campaignProjects'>, port: SupplyPort): SupplyPort {
  const projects = book.projects?.filter((project) => save.campaignProjects[project.id] === 0
    && projectPort(book, project) === port.id) ?? []
  if (!projects.length) return port
  const produces = { ...port.produces }, upkeep = { ...port.upkeep }
  for (const project of projects) for (const kind of ['fuel', 'provisions', 'alloy'] as const) {
    produces[kind] += project.production[kind]
    upkeep[kind] += project.upkeep[kind]
  }
  return { ...port, produces, upkeep }
}

export function fundPortProject(save: Save, book: CampaignBook, project: PortProject): Save {
  const port = save.campaignSupply?.port
  if (!port || !portProjectOpen(book, save, project, port) || save.expedition
    || save.mission || save.pairScene || save.campaignDay.pending || Object.hasOwn(save.campaignProjects, project.id) || save.wallet.alloy < project.alloy) return save
  return observeManagement(save, { ...save, wallet: { ...save.wallet, alloy: save.wallet.alloy - project.alloy },
    campaignProjects: { ...save.campaignProjects, [project.id]: project.days } })
}
