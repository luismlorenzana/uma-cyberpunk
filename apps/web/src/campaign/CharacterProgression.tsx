import { CAMPAIGN_ARMOR_LEVELS, CAMPAIGN_LEVEL_CAP, CAMPAIGN_XP_THRESHOLDS, campaignArmor, campaignLevel, SUBCLASS_NAME, type Save, type Speaker } from '@cyber/domain'
import { BattleHelp } from '../battle/BattleHelp'
import { campaignActorXp, campaignArmorForXp } from './progression'
import { campaignLaserTraining } from './training'

const laserRanks = ['Focused', 'Thermal', 'Impact', 'Pulse power', 'Area', 'Laser-only', '', 'Pulse power', 'Accuracy', 'Rank cap'] as const

function armorBenefit(level: number, curve?: 1) {
  if (!curve) return '+1 Core HP'
  const prev = campaignArmor(level - 1), next = campaignArmor(level)
  return next.core > prev.core ? '+1 Core HP' : next.arms > prev.arms ? '+1 HP per arm' : '+1 Legs HP'
}

export function CharacterProgression({ save, actor, assigned }: { save: Save; actor: Speaker; assigned: boolean }) {
  const xp = campaignActorXp(save, actor)
  const curve = save.campaignCurve
  const level = xp === undefined ? 0 : campaignLevel(xp, curve)
  const armor = campaignArmorForXp(xp ?? 0, curve)
  const threshold = curve ? CAMPAIGN_XP_THRESHOLDS : undefined
  const floor = threshold?.[level - 1] ?? Math.max(0, level - 1) * 100
  const next = threshold?.[level] ?? Math.max(1, level) * 100
  const capped = level === CAMPAIGN_LEVEL_CAP
  const laser = typeof actor === 'number' ? campaignLaserTraining(save, actor) : undefined
  const milestones = curve ? CAMPAIGN_ARMOR_LEVELS.filter(value => value > 1) : [5, 10, 15]
  const nextArmor = milestones.find(value => value > level)
  return <div className={'grid items-start gap-3' + (laser ? ' sm:grid-cols-[minmax(8rem,1fr)_minmax(0,2fr)]' : '')}>
    <section aria-label="Level and experience" className="rounded-xl border border-cyan-200/20 bg-[#142238] px-3 pb-3">
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="font-display text-lg font-bold">{xp === undefined ? 'Level progression' : `Level ${level}`}</h3>
          <p className="text-xs text-slate-300">{xp === undefined ? (assigned && typeof actor === 'string' ? 'Expedition training starts at Lv 6 at first launch.' : 'Earn XP after joining the crew.')
            : capped ? `${xp.toLocaleString()} XP · Level cap` : `${xp.toLocaleString()} total XP · ${next - xp} to Lv ${level + 1}`}</p></div>
        <BattleHelp topic="xp" />
      </div>
      {xp !== undefined && <progress aria-label="Experience to next level" value={capped ? 1 : xp - floor} max={capped ? 1 : next - floor}
        className="mt-2 block h-2 w-full overflow-hidden rounded-full bg-slate-700 accent-cyan-200 [&::-webkit-progress-bar]:bg-slate-700 [&::-webkit-progress-value]:bg-cyan-200" />}
    </section>
    {laser && <section aria-label="Laser rank track">
      <div className="flex items-center justify-between gap-2">
        <div><h3 className="font-display font-bold">Laser mastery</h3>
          <p className="text-xs text-slate-300">{xp === undefined ? 'Starts at Rank 1 on recruitment' : `Rank ${laser.rank}/10 · ${laser.focused ? 'Laser-only' : laser.subclass ? SUBCLASS_NAME[laser.subclass] + ' subclass' : 'No subclass'}`}</p></div>
        <BattleHelp topic="laser" />
      </div>
      <ol className="grid grid-cols-5 gap-1.5" aria-label="Laser ranks">
        {laserRanks.map((label, index) => {
          const rank = index + 1
          const current = xp !== undefined && rank === laser.rank
          const unlocked = xp !== undefined && rank <= laser.rank
          return <li key={rank} aria-current={current ? 'step' : undefined} className={'min-w-0 rounded-lg border px-1.5 py-2 text-center ' +
            (current ? 'border-cyan-200 bg-cyan-200/15' : unlocked ? 'border-cyan-200/30 bg-cyan-200/5' : rank === 6 ? 'border-amber-200/35 bg-amber-200/5' : 'border-white/12 bg-black/15')}>
            <span className={'block font-mono text-xs font-bold ' + (unlocked ? 'text-cyan-200' : 'text-slate-300')}>R{rank}</span>
            <span className="block text-[11px] leading-snug text-slate-200">{label}</span>
          </li>
        })}
      </ol>
      <p className="mt-2 text-xs text-slate-400">Expedition launch opens Rank 6 and retires the subclass.</p>
    </section>}
    <section aria-label="Armor milestones" className={'space-y-2' + (laser ? ' sm:col-span-2' : '')}>
      <div><h3 className="font-display font-bold">Armor milestones</h3>
        <p className="text-xs text-slate-300">+{armor.core} Core · +{armor.arms} per arm · +{armor.legs} Legs</p></div>
      <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {milestones.map(at => <li key={at} aria-current={nextArmor === at ? 'step' : undefined}
          className={'rounded-lg border px-2 py-1.5 text-xs ' + (at <= level ? 'border-cyan-200/30 bg-cyan-200/8' : nextArmor === at ? 'border-amber-200/55 bg-amber-200/8' : 'border-white/10 bg-black/15')}>
          <span className="block font-semibold">Lv {at}{nextArmor === at && ' · Next'}</span><span className="text-slate-300">{armorBenefit(at, curve)}</span>
        </li>)}
      </ol>
    </section>
  </div>
}
