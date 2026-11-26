import { awayMembers, crewSpeaker, issuedCampaignRig, PARTS_BY_ID, rigStats, STAND_IN_BANDS, shipmentAt, SLOT_NAME, storesAt, type CampaignReleaseFile, type Save } from '@cyber/domain'
import { useEffect, useState } from 'react'
import { updateSave } from '../save/game'
import { RigSheet } from './RigSheet'
import { nameOf } from '../story/runner'
import { campaignImage, type LoadedCampaign } from './load'
import { craftCampaignPart, fitCampaignPart, fittedSummary, sendWorkshopAlloy, workshopAt } from './workshop'
import { BattleHelp } from '../battle/BattleHelp'

const button = 'min-h-11 rounded-lg bg-white/10 px-3 text-sm font-semibold text-white disabled:opacity-50'
const partName = (id: string | null) => id ? PARTS_BY_ID.get(id)?.name : undefined

function RecipeIcon({ image }: { image: CampaignReleaseFile }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    let file: string | undefined
    void campaignImage(image).then((value) => {
      if (!live) { URL.revokeObjectURL(value); return }
      file = value
      setUrl(file)
    }, () => { if (live) setUrl(null) })
    return () => { live = false; if (file) URL.revokeObjectURL(file) }
  }, [image])
  return url ? <img src={url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" /> : null
}

export default function WorkshopPanel({ save, loaded, ashore }: { save: Save; loaded: LoadedCampaign; ashore: ReadonlySet<number> }) {
  const [selection, setSelection] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const at = workshopAt(save, loaded.book)
  if (!at) return null
  const crew = save.crew.filter(({ outfit, expeditionOnly }) => !expeditionOnly && !ashore.has(outfit) && !awayMembers(save.operations, save.squads).includes(outfit))
  const member = crew.find(({ outfit }) => outfit === selection) ?? crew[0]
  const rig = member?.rig ?? issuedCampaignRig()
  const currentStats = rigStats(rig, STAND_IN_BANDS)
  const gear = save.campaignGear
  const shipment = shipmentAt(at.cargo, at.port, 'alloy')
  function change(fn: (save: Save) => Save) {
    setBusy(true)
    void updateSave(fn).finally(() => setBusy(false))
  }
  return <section className="space-y-2 rounded-xl border border-white/15 bg-white/5 p-3" aria-label="Campaign Hangar" aria-busy={busy}>
    <h2 className="font-display text-lg font-bold">Campaign Hangar</h2>
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>Hangar Alloy {gear.alloy} · Ship Alloy {save.wallet.alloy}{at.legacy ? ` · Port Alloy ${storesAt(at.cargo, at.port).alloy}` : ''}</span>
      <BattleHelp topic="salvage" />
      {at.legacy && <button type="button" className={button} disabled={busy || sendWorkshopAlloy(save, loaded.book) === save}
        onClick={() => change((s) => sendWorkshopAlloy(s, loaded.book))}>Send {shipment} Alloy to Hangar</button>}
    </div>
    {member && <label className="flex flex-wrap items-center gap-2 text-sm">
      Crew
      <select className="min-h-11 rounded-lg bg-[#182238] px-2" value={member.outfit} onChange={(event) => setSelection(Number(event.currentTarget.value))}>
        {crew.map(member => <option key={member.outfit} value={member.outfit}>{nameOf(loaded.book.story, crewSpeaker(member))}</option>)}
      </select>
      <span>{fittedSummary(rig)}</span>
    </label>}
    {member && <RigSheet rig={rig} xp={member.xp} curve={save.campaignCurve} />}
    <p className="flex flex-wrap items-center text-sm">Workshop reference · Load {currentStats.load}/{currentStats.capacity} · Move {currentStats.move} · Core HP {currentStats.hp.core} · Guard {currentStats.guard}<BattleHelp topic="capacity" /><BattleHelp topic="equipment" /></p>
    <ul className="grid gap-2 sm:grid-cols-2">
      {at.recipes.map((recipe) => {
        const preview = rigStats({ ...rig, [recipe.slot]: recipe.part }, STAND_IN_BANDS)
        const installed = partName(rig[recipe.slot]) ?? 'Empty'
        const owned = gear.parts.includes(recipe.part)
        const fitted = rig[recipe.slot] === recipe.part
        const icon = loaded.assets.get(recipe.icon)
        const name = partName(recipe.part)!
        const fit = member && ((s: Save) => fitCampaignPart(s, loaded.book, member.outfit, recipe.part, !fitted))
        return <li className="space-y-2 rounded-lg bg-black/20 p-2 text-sm" key={recipe.part}>
          <div className="flex items-center gap-2">
            {icon && <RecipeIcon image={icon} />}
            <div><p className="font-semibold">{name}</p><p>{SLOT_NAME[recipe.slot]} · {fitted ? 'Fitted' : owned ? 'In stock' : PARTS_BY_ID.get(recipe.part)?.note}</p></div>
          </div>
          <p className="text-white/75">{fitted ? 'Installed' : 'Replaces ' + installed} · Load {preview.load}/{preview.capacity} · Move {preview.move} · HP {preview.hp.core}/{preview.hp.leftArm}/{preview.hp.rightArm}/{preview.hp.legs} · Guard {preview.guard}</p>
          {preview.weapons.filter(weapon => weapon.name === name).map(weapon => <p key={weapon.mount}>{weapon.band} range · {weapon.hit}% base hit · {weapon.hits} × {weapon.damage} damage</p>)}
          {!owned ? <button type="button" className={button} disabled={busy || gear.alloy < recipe.alloy}
            onClick={() => change((s) => craftCampaignPart(s, loaded.book, recipe.part))}>Build {name} · {recipe.alloy} Alloy</button>
            : <button type="button" className={button} disabled={busy || !fit || fit(save) === save}
              onClick={() => fit && change(fit)}>{fitted ? 'Remove' : 'Fit'} {name}</button>}
        </li>
      })}
    </ul>
  </section>
}
