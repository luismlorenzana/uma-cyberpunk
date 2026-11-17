import { campaignCases, finaleAllies, type CampaignBook, type StoryState } from '@cyber/domain'

export function FinalePanel({ book, story, complete }: { book: CampaignBook; story: StoryState; complete: boolean }) {
  const cases = campaignCases(book, story)
  const filed = cases.filter(({ ready }) => ready).length
  const escorts = finaleAllies(book, story)
  return <section aria-label="Investigation" className="space-y-2 rounded-xl border border-white/15 bg-white/5 p-3">
    <h2 className="font-display text-lg font-bold">{complete ? 'Campaign complete' : 'Investigation'}</h2>
    <p className="text-sm text-cyan-200">{filed}/{cases.length} cases resolved{escorts > 0 && ` · ${escorts} homeworld escorts`}</p>
    <ul className="space-y-1 text-sm">
      {cases.map((entry) => <li key={entry.port}>
        <details className="rounded-lg bg-black/20 px-2">
          <summary className="min-h-11 cursor-pointer py-3">{entry.title} · {entry.ready ? 'Filed' : 'Open'}</summary>
          <div className="space-y-1 pb-2">
            {entry.ready ? <>
              <p>{entry.outcome === 'resettle' ? 'Local crew on watch' : 'Crew assigned aboard'}</p>
              {book.story.files[entry.file]?.lines.map((line, i) => <p key={i}>{line.text}</p>)}
            </> : <p>Complete the local defense and debrief.</p>}
          </div>
        </details>
      </li>)}
    </ul>
  </section>
}
