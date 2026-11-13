// Her profile (CY11, TC4, TC5, TC27, TC46): her bands with each band's job in combat and on the rig, her role and its
// Back unit (changed here, aboard), her Stride, level and Strain with the bench rule.
import { TUNING, type Band, type Role } from '@cyber/battle'
import { changeRole, PARTS_BY_ID, ROLE_NAME, ROLE_PLAYS, ROLES, STRAIN_REST, STRIDE_DOES, STRIDE_NAME, STYLE_NAME } from '@cyber/domain'
import { AlbumArtProvider, UmaBust } from '@luismlorenzana/uma-kit/album'
import { useNavigate } from 'react-router'
import { updateSave } from '../save/game'
import { albumArt } from './art'
import { updateMember, type CrewView } from './view'

const FROM: Record<CrewView['roleFrom'], string> = { set: 'set aboard', tag: 'her story', style: 'her running style', none: 'the default' }

export function bandJobs(b: Record<'speed' | 'stamina' | 'power' | 'guts' | 'wit', Band>): { stat: string; band: Band; combat: string; rig: string }[] {
  const hp = TUNING.partHp
  return [
    { stat: 'Speed', band: b.speed, combat: `Clock +${TUNING.clockRate[b.speed]} a tick, Move ${TUNING.move[b.speed]}`, rig: `Evasion ${TUNING.speedEvasion * b.speed}%` },
    { stat: 'Stamina', band: b.stamina, combat: '—', rig: `Core ${hp.core.base + hp.core.perBand * b.stamina}, arms ${hp.leftArm.base + hp.leftArm.perBand * b.stamina}, Legs ${hp.legs.base + hp.legs.perBand * b.stamina} before parts` },
    { stat: 'Power', band: b.power, combat: `Melee +${TUNING.meleePowerPerBand * b.power} damage`, rig: `Capacity ${TUNING.capacity.base + TUNING.capacity.perBand * b.power} before parts` },
    { stat: 'Guts', band: b.guts, combat: `Hacks on her −${TUNING.tech.perGuts * b.guts}%${b.guts >= TUNING.holdOnBand ? '; Hold on once a battle' : ''}`, rig: '—' },
    { stat: 'Wit', band: b.wit, combat: `Accuracy +${TUNING.witAccuracy * b.wit}%, chance skills and her hacks +${TUNING.skills.perWit * b.wit}%`, rig: `Visor slots ${2 + b.wit} (skills come with parts)` },
  ]
}

export function Profile({ view, nameOf, bond }: { view: CrewView; nameOf: (id: string) => string; bond?: React.ReactNode }) {
  const navigate = useNavigate()
  const back = view.rig.back ? PARTS_BY_ID.get(view.rig.back) : undefined
  const setRole = (role: Role) => void updateSave((s) => updateMember(s, view.outfit, (m) => changeRole(m, role, view.rig)))
  return (
    <div data-profile={view.outfit} className="space-y-3">
      <div className="flex gap-3">
        <div className="h-36 w-28 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/15">
          <AlbumArtProvider art={albumArt(nameOf)}><UmaBust outfitId={String(view.outfit)} label={view.name} size={112} className="size-full" /></AlbumArtProvider>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[22px] font-bold">{view.name}</h2>
          <div className="text-[13px] text-white/70">Level {view.level} · {view.member.xp} XP{view.unknown ? ' · a stand-in card: master data doesn’t hold her yet' : ''}</div>
          <div className="mt-1 text-[14px]"><b className="text-[#2ee6ff]">{ROLE_NAME[view.role]}</b> <span className="text-white/60">({FROM[view.roleFrom]}) · {ROLE_PLAYS[view.role]} · Back unit {back?.name ?? 'none'}</span></div>
          <div className="mt-1 text-[14px]">Stride: {view.stride ? <><b>{STRIDE_NAME[view.stride]}</b> <span className="text-white/60">({STYLE_NAME[view.style!]}): {STRIDE_DOES[view.stride]}</span></> : <span className="text-white/60">none known</span>}</div>
          <div data-strain className="mt-1 flex items-center gap-1 text-[14px]">Strain
            {Array.from({ length: STRAIN_REST }, (_, i) => <span key={i} className={`inline-block size-3 rounded-full ${i < view.member.strain ? 'bg-[#ffb84d]' : 'bg-white/15'}`} />)}
            <span className="text-white/60">{view.resting ? 'Resting: she sits the next mission out' : `${view.member.strain}/${STRAIN_REST}`}</span>
          </div>
        </div>
      </div>
      <div>
        <div className="mb-1 text-[12px] uppercase tracking-widest text-white/50">Role (changed aboard; her Back unit changes with it)</div>
        <div className="flex flex-wrap gap-1.5">
          {ROLES.map((r) => (
            <button key={r} type="button" data-role={r} aria-pressed={r === view.role} onClick={() => setRole(r)}
              className={`min-h-11 rounded-md px-3 text-[14px] font-semibold ${r === view.role ? 'bg-[#2ee6ff] text-[#0b0d17]' : 'bg-white/10'}`}>{ROLE_NAME[r]}</button>
          ))}
        </div>
      </div>
      {bond}
      <table className="w-full text-left text-[13px]">
        <thead className="text-white/50"><tr><th className="py-1 pr-2">Stat</th><th className="pr-2">Band</th><th className="pr-2">In combat</th><th>On the rig</th></tr></thead>
        <tbody>{bandJobs(view.bands).map((r) => (
          <tr key={r.stat} className="border-t border-white/10"><td className="py-1 pr-2 font-semibold">{r.stat}</td><td className="pr-2">{'▮'.repeat(r.band)}<span className="text-white/20">{'▮'.repeat(5 - r.band)}</span></td><td className="pr-2 text-white/80">{r.combat}</td><td className="text-white/80">{r.rig}</td></tr>
        ))}</tbody>
      </table>
      <p className="text-[12px] text-white/50">Strain: each mission adds 1 to every Uma who fought; at {STRAIN_REST} she sits the next one out, which clears it. Resting, she still earns half the XP, and the squad can call one bench support from a resting Uma's role.</p>
      <button type="button" className="min-h-11 rounded-md bg-white/10 px-4 font-display font-bold" onClick={() => void navigate(`/room/hangar?uma=${view.outfit}`)}>Her rig in the Hangar</button>
    </div>
  )
}
