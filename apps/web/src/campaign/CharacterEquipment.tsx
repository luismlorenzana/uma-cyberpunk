import { useState } from 'react'
import { MAX_PRESETS, PARTS_BY_ID, PRESET_NAME_MAX, RIG_SLOTS, SLOT_KIND, SLOT_NAME,
  type CampaignBook, type Rig, type RigSlot, type RigStats, type Save } from '@cyber/domain'
import { BattleHelp } from '../battle/BattleHelp'
import { updateSave } from '../save/game'
import { nameOf } from '../story/runner'
import { armorFrom, characterBuild, characterFitBlock, characterRigProblem, equippedBy, fitCharacterRig, isArmorSlot,
  saveCharacterLoadout, wearCharacterLoadout, type CharacterBuildContext } from './character-build'
import { campaignControl, campaignPrimary } from './CampaignQuestRow'
import { salvageRecipes, salvageTitle } from './salvage'
import { craftCampaignPart, workshopAt } from './workshop'

const disabled = ' disabled:cursor-default disabled:opacity-45'
const partName = (part: string | null) => part ? PARTS_BY_ID.get(part)?.name ?? part : 'Empty'

function changedSlot(rig: Rig, slot: RigSlot, part: string | null): Rig {
  return { ...rig, [slot]: part }
}

function StatComparison({ current, preview }: { current: RigStats; preview: RigStats }) {
  const rows = [
    ['Core HP', current.hp.core, preview.hp.core], ['Left arm HP', current.hp.leftArm, preview.hp.leftArm],
    ['Right arm HP', current.hp.rightArm, preview.hp.rightArm], ['Legs HP', current.hp.legs, preview.hp.legs],
    ['Move', current.move, preview.move], ['Load', current.load, preview.load],
    ['Capacity', current.capacity, preview.capacity], ['Guard', current.guard, preview.guard],
  ] as const
  return <table aria-label="Equipment comparison" className="w-full table-fixed border-separate border-spacing-y-0 text-left text-xs tabular-nums">
    <thead className="text-slate-300"><tr><th scope="col" className="w-[35%] pb-2">Stat</th><th scope="col" className="pb-2 text-right">Equipped</th><th scope="col" className="pb-2 text-right">Preview</th><th scope="col" className="pb-2 text-right">Change</th></tr></thead>
    <tbody>{rows.map(([label, before, after]) => {
      const delta = after - before
      const positive = label === 'Load' ? delta < 0 : delta > 0
      return <tr key={label}>
        <th scope="row" className="border-t border-white/8 py-1.5 font-medium text-slate-200">{label}</th>
        <td className="border-t border-white/8 text-right text-slate-300">{before}{label === 'Guard' && '%'}</td>
        <td className="border-t border-white/8 text-right font-bold">{after}{label === 'Guard' && '%'}</td>
        <td className={'border-t border-white/8 text-right font-bold ' + (delta === 0 ? 'text-slate-400' : positive ? 'text-emerald-200' : 'text-amber-200')}>
          {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta}${label === 'Guard' ? '%' : ''}`}</td>
      </tr>
    })}</tbody>
  </table>
}

export function CharacterEquipment({ book, save, context, build }: {
  book: CampaignBook; save: Save; context: CharacterBuildContext; build?: ReturnType<typeof characterBuild>
}) {
  const [view, setView] = useState<'parts' | 'loadouts'>('parts')
  const [slot, setSlot] = useState<RigSlot>('core')
  const [filter, setFilter] = useState<'owned' | 'all'>('owned')
  const [part, setPart] = useState<string | null>()
  const [presetIndex, setPresetIndex] = useState(0)
  const [presetName, setPresetName] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  if (!build) return <p className="rounded-lg border border-white/10 p-3 text-sm text-slate-300">Equipment appears when a role kit is assigned.</p>

  const { member, equipped, rig, stats, issued, compare } = build
  const blocked = characterFitBlock(save, book, context.actor)
  const editable = isArmorSlot(slot)
  const owned = save.campaignGear.parts
  const rawOptions = editable ? [...PARTS_BY_ID.values()].filter(entry => entry.slot === SLOT_KIND[slot]) : []
  const options = rawOptions.filter(entry => filter === 'all' || owned.includes(entry.id) || issued[slot] === entry.id)
  const choice = part === undefined ? equipped[slot] : part
  const allChoices = editable ? [...new Set([issued[slot], ...options.map(option => option.id)])] : [rig[slot]]
  const selected = allChoices.includes(choice) ? choice : equipped[slot]
  const presets = member?.presets ?? []
  const preset = presets[presetIndex]
  const desired = view === 'parts' ? changedSlot(equipped, slot, selected) : preset ? armorFrom(equipped, preset.rig) : equipped
  const changed = RIG_SLOTS.some(key => equipped[key] !== desired[key])
  const fallback = RIG_SLOTS.some(key => rig[key] !== equipped[key])
  const canSave = typeof context.actor === 'number' && !!member && !member.expeditionOnly && !save.mission && presetIndex <= presets.length
  const fitIssue = changed && (view === 'loadouts' || editable) ? characterRigProblem(save, book, context, desired) : undefined
  const recipe = view === 'parts' && editable ? workshopAt(save, book)?.recipes.find(row => row.part === selected) : undefined
  const canCraft = recipe && !owned.includes(recipe.part)
  const weapons = stats.weapons.map(weapon => ({ ...weapon, range: (weapon.mount === 'Back unit' ? build.loadout.back.weapon
    : weapon.mount === 'Left hand' ? build.loadout.leftHand : build.loadout.rightHand) }))

  function run(change: (current: Save) => Save, success: string) {
    setBusy(true)
    let applied = false
    void updateSave(current => {
      const next = change(current)
      applied = next !== current
      return next
    }).then(() => setFeedback(applied ? success : 'Check Workshop access, part ownership, and Capacity.'))
      .catch(() => setFeedback('The change could not be saved.')).finally(() => setBusy(false))
  }

  function source(id: string | null) {
    if (id === equipped[slot]) return 'Equipped'
    if (id === issued[slot]) return 'Issued'
    if (id !== null) {
      const holder = equippedBy(save, context.actor, id)
      if (holder !== undefined) return `Fitted to ${nameOf(book.story, holder)}`
      if (owned.includes(id)) return 'Owned'
      const salvage = salvageRecipes.find(row => row.part === id)
      if (salvage) return salvageTitle(salvage.contract)
      if (book.workshop?.recipes.some(row => row.part === id)) return 'Workshop recipe'
    }
    return 'Unavailable'
  }

  return <div className="space-y-3" aria-busy={busy}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-1" aria-label="Equipment views">
        {(['parts', 'loadouts'] as const).map(key => <button type="button" key={key} aria-pressed={view === key}
          className={campaignControl + ' aria-pressed:border-cyan-200/70 aria-pressed:text-cyan-200'} onClick={() => { setView(key); setFeedback('') }}>
          {key === 'parts' ? 'Parts' : 'Saved loadouts'}</button>)}
      </div>
      <div className="flex items-center gap-1 text-xs text-slate-300"><span>Load <b className="text-white">{stats.load}/{stats.capacity}</b></span><BattleHelp topic="capacity" /></div>
    </div>
    {view === 'parts' ? <>
      <div aria-label="Equipment slots" className="grid grid-cols-3 gap-1.5">
        {RIG_SLOTS.map(key => <button key={key} type="button" aria-pressed={slot === key} aria-label={`${SLOT_NAME[key]}, ${partName(equipped[key])}`}
          className="min-h-11 min-w-0 rounded-lg border border-white/10 bg-black/15 px-2 py-1 text-left focus-visible:outline-2 focus-visible:outline-cyan-200 aria-pressed:border-cyan-200/75 aria-pressed:bg-cyan-200/10"
          onClick={() => { setSlot(key); setPart(undefined); setFeedback('') }}>
          <span className="block text-[11px] text-slate-300">{SLOT_NAME[key]}</span><span className="block truncate text-xs font-semibold">{partName(equipped[key])}</span>
        </button>)}
      </div>
      {editable ? <section className="rounded-xl border border-white/10 bg-black/15 p-2.5" aria-label={`${SLOT_NAME[slot]} parts`}>
        <div className="flex items-center justify-between gap-2 pb-1">
          <h3 className="font-display font-bold">{SLOT_NAME[slot]} parts</h3>
          <select aria-label="Filter parts" value={filter} className="min-h-11 rounded-lg border border-white/15 bg-[#17273c] px-2 text-xs"
            onChange={event => { setFilter(event.currentTarget.value === 'all' ? 'all' : 'owned'); setPart(undefined); setFeedback('') }}>
            <option value="owned">Equipped & owned</option><option value="all">All parts</option>
          </select>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {allChoices.map(id => <button key={id ?? 'empty'} type="button" aria-pressed={selected === id}
            onClick={() => { setPart(id); setFeedback('') }} className="min-h-11 min-w-0 rounded-lg border border-white/10 px-2 py-1 text-left focus-visible:outline-2 focus-visible:outline-cyan-200 aria-pressed:border-cyan-200/60 aria-pressed:bg-cyan-200/10">
            <span className="block text-sm font-semibold">{partName(id)}</span><span className="block text-xs text-slate-300">{source(id)}</span>
          </button>)}
        </div>
      </section> : <section className="space-y-1 rounded-lg border border-white/10 bg-black/15 p-2.5 text-sm">
        <div className="flex items-center justify-between gap-2"><h3 className="font-display font-bold">Role equipment</h3><BattleHelp topic="equipment" /></div>
        {weapons.map(({ mount, name, hit, hits, damage, range }) => <p key={mount} className="text-xs text-slate-200">
          {name} · {range?.kind === 'weapon' && `${range.range.join('–')} tiles · `}{hit}% hit · {hits} × {damage}
        </p>)}
        <p className="text-xs text-slate-400">Weapons and the Back unit follow the class and mission.</p>
      </section>}
    </> : <section aria-label="Saved loadouts" className="space-y-2 rounded-xl border border-white/10 bg-black/15 p-2.5">
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: MAX_PRESETS }, (_, index) => <button key={index} type="button" aria-pressed={presetIndex === index}
          className="min-h-11 min-w-0 rounded-lg border border-white/10 px-2 py-1 text-left text-xs focus-visible:outline-2 focus-visible:outline-cyan-200 aria-pressed:border-cyan-200/70 aria-pressed:bg-cyan-200/10"
          onClick={() => { setPresetIndex(index); setPresetName(presets[index]?.name ?? ''); setFeedback('') }}>
          <span className="block text-slate-400">Loadout {index + 1}</span><span className="block truncate font-semibold">{presets[index]?.name ?? 'Empty'}</span>
        </button>)}
      </div>
      {canSave && <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Loadout name" placeholder={preset?.name ?? `Loadout ${presetIndex + 1}`} maxLength={PRESET_NAME_MAX}
          value={presetName} onChange={event => setPresetName(event.currentTarget.value)} className="min-h-11 min-w-24 flex-1 rounded-lg border border-white/15 bg-[#17273c] px-2 text-sm" />
        <button type="button" disabled={busy || fallback} className={campaignControl + disabled}
          onClick={() => run(current => saveCharacterLoadout(current, context, presetIndex, presetName || preset?.name || ''), 'Loadout saved.')}>
          {preset ? 'Replace with equipped' : 'Save equipped'}</button>
      </div>}
      {fallback && <p className="text-xs text-amber-200">Fit armor within Capacity before saving a loadout.</p>}
      <p className="text-xs text-slate-400">Loadouts save armor. Class and mission supply weapon mounts.</p>
    </section>}
    {(view === 'parts' && editable || view === 'loadouts' && preset) && <section aria-label="Fit preview" className="space-y-2 rounded-xl border border-cyan-200/20 bg-[#142238] p-2.5">
      <h3 className="font-display font-bold">{view === 'parts' ? partName(selected) : preset?.name}</h3>
      {fallback && <p className="text-xs text-amber-200">The stored fit exceeds this preview’s Capacity. The equipped totals show issued gear.</p>}
      <StatComparison current={stats} preview={compare(desired)} />
      {fitIssue && <p className="text-xs text-amber-200">{fitIssue}</p>}
      <div className="flex flex-wrap gap-2">
        {canCraft && <button type="button" className={campaignControl + disabled} disabled={busy || save.campaignGear.alloy < recipe.alloy}
          onClick={() => run(current => craftCampaignPart(current, book, recipe.part), 'Part crafted.')}>
          Craft · {recipe.alloy} Hangar Alloy</button>}
        <button type="button" className={campaignPrimary + disabled} disabled={busy || !changed || !!fitIssue}
          onClick={() => run(current => {
            if (view === 'loadouts') return wearCharacterLoadout(current, book, context, presetIndex)
            const currentRig = characterBuild(current, context)?.equipped
            return currentRig ? fitCharacterRig(current, book, context, changedSlot(currentRig, slot, selected)) : current
          }, view === 'parts' ? 'Part fitted.' : 'Loadout equipped.')}>
          {view === 'parts' ? (selected === issued[slot] ? 'Use issued part' : 'Fit part') : 'Equip loadout'}
        </button>
      </div>
    </section>}
    {blocked && blocked !== fitIssue && <p className="text-xs text-slate-400">{blocked}</p>}
    {feedback && <p role="status" className="text-sm text-cyan-200">{feedback}</p>}
  </div>
}
