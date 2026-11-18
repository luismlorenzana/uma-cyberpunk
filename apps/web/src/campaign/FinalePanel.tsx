import { campaignCases, finaleAllies, fleetMobilized, sectorRetired, type CampaignBook, type StoryState } from '@cyber/domain'

export function FinalePanel({ book, story, complete }: { book: CampaignBook; story: StoryState; complete: boolean }) {
  const cases = campaignCases(book, story)
  const filed = cases.filter(({ ready }) => ready).length
  const escorts = finaleAllies(book, story)
  const restored = book.quests.some(({ id, scene }) => id === book.finale?.ending && story.seen.includes(scene))
  const lastWatch = book.finale?.lastWatch
  const continuing = lastWatch && book.recruits?.some(({ signOn }) =>
    book.quests.some(({ id, after }) => id === signOn && after === lastWatch))
  return <section aria-label="Investigation" className="space-y-2 rounded-xl border border-white/15 bg-white/5 p-3">
    <h2 className="font-display text-lg font-bold">{complete ? continuing ? 'Tier 1 complete' : 'Campaign complete' : restored ? 'Civilian passage restored' : 'Investigation'}</h2>
    <p className="text-sm text-cyan-200">{filed}/{cases.length} cases resolved{!book.finale?.muster && escorts > 0 && ` · ${escorts} homeworld escorts`}</p>
    {book.finale?.muster && <p className="text-sm">{fleetMobilized(book, story).length}/{book.sectors?.length} commands ready</p>}
    {restored && book.finale?.lastWatch && <p className="text-sm">{book.sectors?.filter((sector) => sectorRetired(book, story, sector)).length}/{book.sectors?.length} handovers complete</p>}
    <ul className="space-y-1 text-sm">
      {cases.map((entry) => <li key={entry.port}>
        <details className="rounded-lg bg-black/20 px-2">
          <summary className="min-h-11 cursor-pointer py-3">{entry.title} · {entry.ready ? 'Filed' : 'Open'}</summary>
          <div className="space-y-1 pb-2">
            {entry.ready ? <>
              {entry.outcome && <p>{entry.outcome === 'resettle' ? 'Local crew on watch' : 'Crew assigned aboard'}</p>}
              {book.story.files[entry.file]?.lines.map((line, i) => <p key={i}>{line.text}</p>)}
            </> : <p>{entry.fileQuest ? 'Complete the case debrief.' : 'Complete the local defense and debrief.'}</p>}
          </div>
        </details>
      </li>)}
    </ul>
  </section>
}
