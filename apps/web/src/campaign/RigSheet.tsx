import { PARTS_BY_ID, RIG_SLOTS, SLOT_NAME, levelOf, type Rig } from '@cyber/domain'
import { veteranCoreHp } from './progression'

export function RigSheet({ rig, xp }: { rig: Rig | null; xp: number }) {
  const level = levelOf(xp)
  return <div className="space-y-2 text-sm">
    <p>{level < 50 ? (100 - xp % 100) + ' XP to level ' + (level + 1) : 'Maximum level'} · +{veteranCoreHp(xp)} veteran Core HP</p>
    {rig ? <details>
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Fitted equipment</summary>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">{RIG_SLOTS.map(slot => <div key={slot} className="contents">
        <dt className="text-slate-300">{SLOT_NAME[slot]}</dt><dd>{PARTS_BY_ID.get(rig[slot] ?? '')?.name ?? 'Empty'}</dd>
      </div>)}</dl>
    </details> : <p className="text-slate-300">Issued kit varies by mission.</p>}
  </div>
}
