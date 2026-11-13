// Her bond on her profile (CY13, TC56): a ten-segment ring, her path from rank 8, the rapport toward the next rank (or
// the story key it waits on), the perks each rank brings in battle (played from rules version 3, CY17), and her bond scene
// when one is ready.
import { BOND_MAX, BOND_PERKS, BOND_TUNING, bondProgress, keyWords, RESONANCE_NAME, type Bond, type CrewMember, type Save, type StoryPack } from '@cyber/domain'
import { gateOpenFor, readyBondScene } from './bonds'

const PATH = { trust: { mark: '◆', name: 'Trust', hue: '#2ee6ff' }, heart: { mark: '♥', name: 'Heart', hue: '#ff3dc8' } } as const

/** The ring: ten segments, the ranks reached lit in her path's colour, the next one part-filled. */
export function BondRing({ bond, size = 56 }: { bond: Bond; size?: number }) {
  const hue = bond.path ? PATH[bond.path].hue : '#ffb84d'
  const r = size / 2 - 4, c = size / 2
  const seg = (i: number) => {
    const a0 = (i / BOND_MAX) * Math.PI * 2 - Math.PI / 2 + 0.06, a1 = ((i + 1) / BOND_MAX) * Math.PI * 2 - Math.PI / 2 - 0.06
    return `M ${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)}`
  }
  return (
    <svg data-bond-ring={bond.rank} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Bond rank ${bond.rank}`}>
      {Array.from({ length: BOND_MAX }, (_, i) => (
        <path key={i} d={seg(i)} fill="none" strokeWidth={4} strokeLinecap="round" stroke={i < bond.rank ? hue : '#ffffff22'} opacity={i === bond.rank ? 0.35 + bondProgress(bond) * 0.65 : 1} />
      ))}
      <text x={c} y={c + 5} textAnchor="middle" fontSize={size * 0.3} fontWeight={700} fill="#e8ebf5">{bond.rank}</text>
    </svg>
  )
}

export function BondPanel({ member, pack, save, onPlay }: { member: CrewMember; pack: StoryPack | null; save: Save; onPlay: (rank: number) => void }) {
  const { bond } = member
  const ready = readyBondScene(pack, member)
  const next = bond.rank + 1
  const gateKey = pack?.casting.bondGates?.[String(next)]
  const waiting = bond.rank < BOND_MAX && !gateOpenFor(pack, save)(next)
  return (
    <div data-bond={member.outfit} className="rounded-lg bg-white/5 p-3">
      <div className="flex items-center gap-3">
        <BondRing bond={bond} />
        <div className="min-w-0 flex-1 text-[13px]">
          <div className="font-display text-[15px] font-bold">Bond rank {bond.rank}{bond.path && <span className="ml-2" style={{ color: PATH[bond.path].hue }}>{PATH[bond.path].mark} {PATH[bond.path].name}</span>}</div>
          <div className="text-white/60">
            {bond.rank >= BOND_MAX ? 'The highest rank: her Resonance is ready'
              : waiting && gateKey ? `Rank ${next} waits on the story: ${keyWords(gateKey, pack!)}`
              : `${bond.rapport} / ${BOND_TUNING.toRank[next]} rapport to rank ${next}`}
          </div>
        </div>
        {ready !== null && <button type="button" data-play-bond={ready} onClick={() => onPlay(ready)} className="min-h-11 shrink-0 rounded-md bg-[#ff3dc8] px-3 font-display text-[13px] font-bold text-[#0b0d17]">Her rank {ready} scene</button>}
      </div>
      <div className="mt-2 grid grid-cols-1 gap-0.5 text-[12px]">
        {BOND_PERKS.map((p) => (
          <div key={p.id} className={p.rank <= bond.rank ? 'text-[#e8ebf5]' : 'text-white/35'}>
            <b>Rank {p.rank} · {p.id === 'resonance' && bond.path ? RESONANCE_NAME[bond.path] : p.name}:</b> {p.does}
          </div>
        ))}
        <div className="pt-1 text-white/40">Perks play in battle with rules version 3 (CY17). Trust and Heart give the same power.</div>
      </div>
    </div>
  )
}
