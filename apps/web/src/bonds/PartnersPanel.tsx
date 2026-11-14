// Partners on her profile (CY17, TC58): her camaraderie with each Uma aboard (from battles fought together and posts held
// together), her partner and their level, and the button that makes two Umas partners once they reach 100.
import { makePartners, PARTNER_TUNING, pairKey, partnershipOf, partnerProblem, unmakePartners, type Save } from '@cyber/domain'
import { updateSave } from '../save/game'

const LEVEL = ['', 'joins your attacks free once a battle', 'also covers you free once a battle', 'and the duo technique']

export function PartnersPanel({ save, outfit, nameOf }: { save: Save; outfit: number; nameOf: (o: number) => string }) {
  const mine = partnershipOf(save.partners, outfit)
  const researched = save.ship.research.done.includes(PARTNER_TUNING.level3)
  const others = save.crew.filter((m) => m.outfit !== outfit)
  return (
    <div data-partners className="rounded-lg bg-white/5 p-2 text-[13px]">
      <div className="mb-1 font-display font-bold">Partners</div>
      {mine ? (
        <div data-partner={mine.a === outfit ? mine.b : mine.a} className="mb-1">
          Partnered with <b>{nameOf(mine.a === outfit ? mine.b : mine.a)}</b>, level {mine.level}: {LEVEL.slice(1, mine.level + 1).join(', ')}.
          <button type="button" className="ml-2 text-white/50 underline" onClick={() => void updateSave((s) => ({ ...s, partners: unmakePartners(s.partners, outfit) }))}>Part ways</button>
        </div>
      ) : <div className="mb-1 text-white/60">No partner yet: camaraderie {PARTNER_TUNING.at[0]} with another Uma makes one possible.</div>}
      <div className="flex flex-wrap gap-1.5">
        {others.map((m) => {
          const cam = save.camaraderie[pairKey(outfit, m.outfit)] ?? 0
          const problem = partnerProblem(save.partners, save.camaraderie, outfit, m.outfit)
          return (
            <span key={m.outfit} data-camaraderie={m.outfit} className="rounded bg-white/5 px-2 py-1">
              {nameOf(m.outfit)} <b>{cam}</b>
              {!mine && !problem && <button type="button" data-make-partners={m.outfit} className="ml-1 rounded bg-[#2ee6ff] px-2 font-bold text-[#0b0d17]"
                onClick={() => void updateSave((s) => ({ ...s, partners: makePartners(s.partners, s.camaraderie, outfit, m.outfit, researched) }))}>Partner</button>}
            </span>
          )
        })}
      </div>
      <p className="mt-1 text-[12px] text-white/45">Camaraderie: +{PARTNER_TUNING.battle} a battle fought together, +{PARTNER_TUNING.assist} more when one covers or reboots the other, +1 a watch on the same room’s posts. Levels at {PARTNER_TUNING.at.join(', ')}; level 3 also needs the Coordinated Fire project.</p>
    </div>
  )
}
