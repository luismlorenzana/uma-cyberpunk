// The Quarters (CY11, TC42): the crew aboard on uma-kit's face tiles (a stand-in card when master data doesn't hold her),
// who rests next mission, and her profile beside the roster.
import { ROLE_NAME, STRAIN_REST } from '@cyber/domain'
import { AlbumArtProvider, FaceTile } from '@luismlorenzana/uma-kit/album'
import { useMemo, useState } from 'react'
import { albumArt } from './art'
import { Profile } from './Profile'
import { useCrew } from './useCrew'

export function Quarters() {
  const { crew } = useCrew()
  const [picked, setPicked] = useState<number | null>(null)
  const nameOf = useMemo(() => (id: string) => crew.find((c) => String(c.outfit) === id)?.name ?? `Uma ${id}`, [crew])
  const art = useMemo(() => albumArt(nameOf), [nameOf])
  if (crew.length === 0) return <div className="flex h-full items-center justify-center p-10 text-center text-white/60">No one is aboard yet: the crew comes aboard through the story.</div>
  const view = crew.find((c) => c.outfit === picked) ?? crew[0]!
  const resting = crew.filter((c) => c.resting)
  return (
    <div className="flex h-full gap-4" style={{ padding: 'calc(var(--inset-top) + 64px) calc(var(--inset-right) + 14px) calc(var(--inset-bottom) + 14px) calc(var(--inset-left) + 14px)' }}>
      <div className="w-[46%] shrink-0 space-y-3 overflow-y-auto">
        <AlbumArtProvider art={art}>
          <div data-roster className="grid grid-cols-4 gap-2">
            {crew.map((c) => (
              <button key={c.outfit} type="button" data-member={c.outfit} onClick={() => setPicked(c.outfit)} className="flex flex-col items-center gap-1 rounded-lg p-1 text-center">
                <FaceTile outfitId={String(c.outfit)} size={68} label={c.name} selected={c.outfit === view.outfit} locked={c.resting}
                  badges={{ topLeft: <span className="rounded bg-[#0b0d17]/80 px-1 text-[10px] font-bold text-[#2ee6ff]">{ROLE_NAME[c.role].slice(0, 3)}</span>, bottomRight: c.member.strain ? <span className="rounded bg-[#0b0d17]/80 px-1 text-[10px] font-bold text-[#ffb84d]">{c.member.strain}</span> : undefined }} />
                <span className="w-full truncate text-[12px] font-semibold">{c.name}</span>
              </button>
            ))}
          </div>
        </AlbumArtProvider>
        <div data-resting className="rounded-lg bg-[#141827] p-3 text-[13px] ring-1 ring-white/10">
          <div className="mb-1 font-display font-bold">Resting next mission</div>
          {resting.length ? resting.map((c) => <div key={c.outfit}>{c.name} (Strain {STRAIN_REST})</div>) : <div className="text-white/60">No one: every Uma is under Strain {STRAIN_REST}.</div>}
          <div className="mt-2 text-white/50">{crew.map((c) => `${c.name} ${c.member.strain}`).join(' · ')}</div>
        </div>
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto rounded-xl bg-[#141827] p-4 ring-1 ring-white/10"><Profile view={view} nameOf={nameOf} /></div>
    </div>
  )
}
