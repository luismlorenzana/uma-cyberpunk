import { nextCampaignStop, sectorAssignment, shipCapabilities, type CampaignBook, type CampaignQuest, type CampaignRecruit, type CampaignReleaseFile, type Save, type Speaker } from '@cyber/domain'
import { nameOf } from '../story/runner'
import { questAvailable, recruitOnBoard, recruitProgress } from './quests'
import { sectorStatus } from './SectorPanel'
import { CampaignThumbnail } from './CampaignThumbnail'
import { useState } from 'react'
import { Wardrobe } from './Wardrobe'

const action = 'min-h-11 rounded-lg bg-cyan-200 px-3 text-sm font-semibold text-slate-950 disabled:bg-white/10 disabled:text-white/60'

export function RecruitmentPanel({ save, book, assets, recruits, port, open }: {
  save: Save; book: CampaignBook; recruits: CampaignRecruit[]; port?: string
  assets: ReadonlyMap<string, CampaignReleaseFile>
  open: (quest: CampaignQuest) => void
}) {
  const [wardrobe, setWardrobe] = useState<Speaker | null>(null)
  const companions = book.wardrobe?.members.filter(row => typeof row.speaker === 'string' && row.after && save.story.seen.includes(row.after)
    && (!row.requiresFlag || save.story.flags.includes(row.requiresFlag))) ?? []
  const progress = recruits.filter((recruit) => recruitOnBoard(save, book, recruit))
    .map((recruit) => ({ recruit, ...recruitProgress(save, book, recruit) }))
  const boards = [
    { title: 'Recruitment', entries: progress.filter(({ joined }) => !joined) },
    { title: 'Crew stories', entries: progress.filter(({ joined }) => joined) },
  ]
  return <div className="space-y-3">
    {wardrobe !== null && (progress.some(row => row.joined && row.recruit.outfit === wardrobe) || companions.some(row => row.speaker === wardrobe)) && <Wardrobe key={wardrobe} book={book} assets={assets} speaker={wardrobe} back={() => setWardrobe(null)} />}
    {companions.length > 0 && <section aria-label="Ally wardrobes" className="space-y-2">
      <h2 className="font-display text-lg font-bold">Ally wardrobes</h2>
      <div className="flex flex-wrap gap-2">{companions.map(row => <button type="button" key={row.speaker} className="min-h-11 rounded-lg bg-white/10 px-3 text-sm" onClick={() => setWardrobe(row.speaker)}>{nameOf(book.story, row.speaker)}</button>)}</div>
    </section>}
    {boards.map(({ title, entries }) => entries.length > 0 && <section key={title} aria-label={title} className="space-y-2">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <ul className="space-y-2">
        {entries.map(({ recruit, joined, next, started }) => {
          const destination = book.supply?.ports.find((entry) => entry.id === next?.port)
          const hop = destination && port && port !== destination.id && book.supply
            ? nextCampaignStop(book.supply, port, destination.id, shipCapabilities(save.ship), save.story.flags) : null
          const stop = hop && hop !== destination?.id ? book.supply?.ports.find(({ id }) => id === hop) : undefined
          const ready = !!next && questAvailable(save, book, next, port)
          const sector = book.sectors?.find(({ officer }) => officer === recruit.outfit)
          const signOn = book.quests.find(({ id }) => id === recruit.signOn)
          const profile = book.wardrobe?.members.find(row => row.speaker === recruit.outfit)?.looks['ship-casual']?.profile ?? book.art.find(({ scene }) => scene === signOn?.scene)?.portraits.find(({ speaker, emote }) =>
            speaker === recruit.outfit && emote === undefined)?.profile
          return <li key={recruit.outfit} data-recruit={recruit.outfit} className="space-y-1 rounded-lg border border-white/15 bg-white/5 p-2">
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
            {joined && book.wardrobe?.members.some(row => row.speaker === recruit.outfit) && <button type="button" className="ml-2 min-h-11 rounded-lg bg-white/10 px-3 text-sm" onClick={() => setWardrobe(recruit.outfit)}>Wardrobe</button>}
          </li>
        })}
      </ul>
    </section>)}
  </div>
}
