import type { Bands } from '@cyber/battle'
import { BattleHelp } from '../battle/BattleHelp'
import type { characterBuild } from './character-build'

const attributes = [
  ['speed', 'Speed', 'Turn order and movement'], ['stamina', 'Stamina', 'Core and limb HP'], ['power', 'Power', 'Capacity and melee damage'],
  ['guts', 'Guts', 'Hack resistance'], ['wit', 'Wit', 'Accuracy and hacking'],
] as const

export function CharacterStats({ bands, personal, build }: {
  bands: Bands; personal: boolean; build?: ReturnType<typeof characterBuild>
}) {
  const stats = build?.stats
  return <div className="space-y-4">
    <section aria-label="Combat attributes">
      <div className="flex items-center justify-between gap-2">
        <div><h3 className="font-display font-bold">Combat attributes</h3>
          <p className="text-xs text-slate-400">{personal ? 'Personal bands' : 'Standard bands for this preview'}</p></div>
        <BattleHelp topic="armor" />
      </div>
      <dl className="divide-y divide-white/8 rounded-lg border border-white/10 bg-black/15 px-3">
        {attributes.map(([key, label, use]) => <div key={key} className="grid grid-cols-[minmax(6.5rem,1fr)_minmax(5rem,1fr)_1.35rem] items-center gap-3 py-2">
          <dt className="min-w-0"><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-slate-400">{use}</span></dt>
          <dd role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={5} aria-valuenow={bands[key]} className="grid grid-cols-5 gap-1">
            {Array.from({ length: 5 }, (_, index) => <span key={index} aria-hidden="true" className={'h-1.5 rounded-sm ' + (index < bands[key] ? 'bg-cyan-200' : 'bg-white/12')} />)}
          </dd>
          <dd className="text-center font-mono text-sm tabular-nums text-cyan-200">{bands[key]}</dd>
        </div>)}
      </dl>
    </section>
    {stats && <section aria-label="Equipped combat stats" className="space-y-2">
      <h3 className="font-display font-bold">Equipped combat stats</h3>
      <dl className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {([['Core HP', stats.hp.core], ['Left arm HP', stats.hp.leftArm], ['Right arm HP', stats.hp.rightArm], ['Legs HP', stats.hp.legs],
          ['Move', stats.move], ['Guard', stats.guard + '%'], ['Load', `${stats.load}/${stats.capacity}`]] as const).map(([label, value]) =>
          <div key={label} className="min-w-0 rounded-lg border border-white/10 bg-[#17273c] p-2">
            <dt className="text-xs text-slate-300">{label}</dt><dd className="font-display font-bold tabular-nums">{value}</dd>
          </div>)}
      </dl>
      <p className="text-xs text-slate-400">Includes level armor and the current kit. See Effective sortie stats for mission adjustments.</p>
    </section>}
  </div>
}
