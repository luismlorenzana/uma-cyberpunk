// Entry point served by the opt-in local review middleware. Uses the same battle screen and rules as Campaign Training.
import '../index.css'
import type { Dir } from '@cyber/battle'
import { TurnedStage } from '@luismlorenzana/uma-stage'
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BattleView } from '../battle/BattleView'
import { resume } from '../battle/session'
import { TRAINING_REVIEWS, trainingReview, type TrainingReplay, type TrainingReview } from './training-review-fixture'

declare global { interface Window { __trainingReview?: TrainingReplay } }

function ReviewTurn({ replay }: { replay: TrainingReplay }) {
  const [played, setPlayed] = useState(false)
  return <button type="button" disabled={played} className="absolute right-3 top-14 z-20 min-h-11 rounded bg-[#141827]/95 px-3 text-sm text-white"
    onClick={() => { if (window.__sandbox) { setPlayed(true); void window.__sandbox.play(replay.action) } }}>
    {played ? 'Review turn played' : 'Play review turn'}
  </button>
}

async function main(): Promise<void> {
  const root = createRoot(document.getElementById('root')!)
  try {
    const params = new URLSearchParams(location.search)
    const review = params.get('case') ?? 'issued-rifle'
    const facing = params.get('facing') ?? 'N'
    if (!(TRAINING_REVIEWS as readonly string[]).includes(review) || !['N', 'E', 'S', 'W'].includes(facing)) throw new Error('Unknown Training review')
    const response = await fetch('/__cyber-combat-sprites/binding.json')
    if (!response.ok) throw new Error('Local combat sprite binding unavailable')
    const { outfit } = await response.json() as { outfit: unknown }
    if (typeof outfit !== 'number' || !Number.isSafeInteger(outfit)) throw new Error('Expected a crew outfit')
    const replay = trainingReview(outfit, review as TrainingReview, facing as Dir)
    const session = resume(replay.input, replay.prefix)
    if ('error' in session) throw new Error(session.error)
    window.__trainingReview = replay
    root.render(<TurnedStage>{layout => <><BattleView layout={layout} session={session} control={{ squad: 'player', enemy: 'player' }}
      debug training combatSprites={[]} objectiveLabel="Training Deck"
      onCommit={() => {}} onEnd={() => {}} onQuit={() => { location.assign('/campaign') }} /><ReviewTurn replay={replay} /></>}</TurnedStage>)
  } catch (error) {
    root.render(<p role="alert">{String(error)}</p>)
  }
}

void main()
