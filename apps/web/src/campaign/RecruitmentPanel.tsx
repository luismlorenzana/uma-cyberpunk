import { nextCampaignStop, sectorAssignment, shipCapabilities, type CampaignBook, type CampaignQuest, type CampaignRecruit, type CampaignReleaseFile, type Save } from '@cyber/domain'
import { nameOf } from '../story/runner'
import { questAvailable, recruitProgress } from './quests'
import { sectorStatus } from './SectorPanel'
import { CampaignThumbnail } from './CampaignThumbnail'

const action = 'min-h-11 rounded-lg bg-cyan-200 px-3 text-sm font-semibold text-slate-950 disabled:bg-white/10 disabled:text-white/60'

export function RecruitmentPanel({ save, book, assets, recruits, port, open }: {
  save: Save; book: CampaignBook; recruits: CampaignRecruit[]; port?: string
  assets: ReadonlyMap<string, CampaignReleaseFile>
  open: (quest: CampaignQuest) => void
}) {
  const progress = recruits.map((recruit) => ({ recruit, ...recruitProgress(save, book, recruit) }))
  const boards = [
    { title: 'Recruitment', entries: progress.filter(({ joined }) => !joined) },
    { title: 'Crew stories', entries: progress.filter(({ joined }) => joined) },
  ]
  return <div className="space-y-3">
    {boards.map(({ title, entries }) => entries.length > 0 && <section key={title} aria-label={title} className="space-y-2">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <ul className="space-y-2">
        {entries.map(({ recruit, joined, next, started }) => {
          const destination = book.supply?.ports.find((entry) => entry.id === next?.port)
          const hop = destination && port && port !== destination.id && book.supply
            ? nextCampaignStop(book.supply, port, destination.id, shipCapabilities(save.ship)) : null
          const stop = hop && hop !== destination?.id ? book.supply?.ports.find(({ id }) => id === hop) : undefined
          const ready = !!next && questAvailable(save, book, next, port)
          const sector = book.sectors?.find(({ officer }) => officer === recruit.outfit)
          const signOn = book.quests.find(({ id }) => id === recruit.signOn)
          const profile = book.art.find(({ scene }) => scene === signOn?.scene)?.portraits.find(({ speaker, emote }) =>
            speaker === recruit.outfit && emote === undefined)?.profile
          return <li key={recruit.outfit} className="space-y-1 rounded-lg border border-white/15 bg-white/5 p-2">
            {profile && <CampaignThumbnail asset={assets.get(profile)} className="float-right size-12 rounded-md object-cover" />}
            <h3 className="break-words font-semibold">{nameOf(book.story, recruit.outfit)}</h3>
            {!joined && <p className="text-sm">{recruit.request}</p>}
            {joined && <p className="text-sm">{next?.title ?? 'Objectives complete'}</p>}
            {joined && sector && <p className="text-sm text-white/75">{sectorStatus[sectorAssignment(book, save.story, sector)]}</p>}
            {destination && <p className="text-sm text-white/75">{destination.name}{destination.id === port ? ' · Docked' : ''}</p>}
            {stop && <p className="text-sm text-white/75">Via {stop.name}</p>}
            {next && <button type="button" className={action} disabled={!ready} onClick={() => open(next)}>
              {joined ? started ? 'Continue story' : 'Start story' : 'Sign on'}
            </button>}
          </li>
        })}
      </ul>
    </section>)}
  </div>
}
