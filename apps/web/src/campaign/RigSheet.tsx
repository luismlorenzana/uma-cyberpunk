import { CAMPAIGN_LEVEL_CAP, CAMPAIGN_XP_THRESHOLDS, PARTS_BY_ID, RIG_SLOTS, SLOT_NAME, campaignArmor, campaignLevel, type Rig } from '@cyber/domain'
import { veteranCoreHp } from './progression'
import { BattleHelp } from '../battle/BattleHelp'

export function RigSheet({ rig, xp, curve }: { rig: Rig | null; xp: number; curve?: 1 }) {
  const level = campaignLevel(xp, curve)
  const armor = curve ? campaignArmor(level) : { core: veteranCoreHp(xp), arms: 0, legs: 0, next: undefined }
  const next = curve ? (CAMPAIGN_XP_THRESHOLDS[level] ?? xp) - xp : 100 - xp % 100
  return <div className="space-y-2 text-sm">
    <p className="flex flex-wrap items-center">{level < CAMPAIGN_LEVEL_CAP ? next + ' XP to level ' + (level + 1) : 'Maximum level'}
      {' · Armor +'}{armor.core} Core / +{armor.arms} each arm / +{armor.legs} Legs {armor.next && ` · Next at Lv ${armor.next}`}
      <BattleHelp topic="xp" /></p>
    {rig ? <details>
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Fitted equipment</summary>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">{RIG_SLOTS.map(slot => <div key={slot} className="contents">
        <dt className="text-slate-300">{SLOT_NAME[slot]}</dt><dd>{PARTS_BY_ID.get(rig[slot] ?? '')?.name ?? 'Empty'}</dd>
      </div>)}</dl>
    </details> : <p className="text-slate-300">Issued kit varies by mission.</p>}
  </div>
}
