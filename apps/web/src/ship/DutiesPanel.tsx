// The Duties overview (CY16, TC67, TC68): every post aboard with its holder, her aptitude as a three-step mark, her
// tenure and mastery; a tap assigns; Auto-assign fills every post in one tap; two presets keep arrangements. Loaded on
// demand from the ship's header.
import { aptitude, assignPost, MODULES_BY_ID, postKey, POSTS, shipPosts, stars, type Post, type Save } from '@cyber/domain'
import { useState } from 'react'
import type { CrewView } from '../crew/view'
import { updateSave } from '../save/game'
import { autoAssignSave, loadPreset, savePreset } from './duties'

const btn = 'min-h-11 rounded-md bg-white/10 px-3 text-[14px] font-semibold disabled:opacity-40'
const primary = 'min-h-11 rounded-md bg-[#2ee6ff] px-4 font-display font-bold text-[#0b0d17]'

export function AptitudeMark({ level }: { level: 1 | 2 | 3 }) {
  return <span data-aptitude={level} title={['', 'Half: band 2 or less', 'Does the job: band 3', 'The extra: band 4–5'][level]} className="tracking-tighter text-[#ffd166]">{'●'.repeat(level)}<span className="text-white/20">{'●'.repeat(3 - level)}</span></span>
}

export default function DutiesPanel({ save, crew, onClose }: { save: Save; crew: readonly CrewView[]; onClose: () => void }) {
  const [picking, setPicking] = useState<Post | null>(null)
  const posts = shipPosts(save.ship)
  const holderOf = (p: Post) => crew.find((v) => v.member.post && postKey(v.member.post) === postKey(p))
  return (
    <div data-duties className="absolute left-1/2 top-1/2 z-30 max-h-[86%] w-[min(40rem,92%)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-[#141827] p-4 ring-1 ring-white/15">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-[20px] font-bold">Duties</h2>
        <span className="text-[12px] text-white/50">Posts produce once a watch onto one ship-log card. Nothing decays.</span>
        <button type="button" onClick={onClose} className="ml-auto min-h-11 min-w-11 text-white/60" aria-label="Close">✕</button>
      </div>
      <div className="my-2 flex flex-wrap gap-1.5">
        <button type="button" data-auto-assign className={primary} onClick={() => void updateSave((s) => autoAssignSave(s, crew))}>Auto-assign</button>
        {[0, 1].map((i) => (
          <span key={i} className="flex gap-1">
            <button type="button" data-preset-load={i} className={btn} disabled={!save.dutyPresets[i]} onClick={() => void updateSave((s) => loadPreset(s, i))}>{save.dutyPresets[i]?.name ?? `Preset ${i + 1}`}</button>
            <button type="button" data-preset-save={i} className={btn} onClick={() => void updateSave((s) => savePreset(s, i, `Preset ${i + 1}`))} title="Keep the current arrangement">Keep</button>
          </span>
        ))}
      </div>
      {posts.length === 0 && <p className="text-[13px] text-white/60">No posts yet: modules bring posts as they're built.</p>}
      <div className="space-y-1">
        {posts.map((p) => {
          const h = holderOf(p), def = POSTS[p.kind]
          const held = h?.member.post
          return (
            <div key={postKey(p)} data-post={postKey(p)} className="rounded-md bg-white/5 p-2 text-[13px]">
              <div className="flex items-center gap-2">
                <b className="w-40 shrink-0">{def.name} <span className="font-normal text-white/50">· {MODULES_BY_ID.get(p.module)!.name}</span></b>
                <span className="min-w-0 flex-1 truncate">{h ? <>{h.name} <AptitudeMark level={aptitude(p.kind, h.bands)} /> <span className="text-white/50">{held ? `${Math.max(0, save.watch - held.since + 1)} watches · ${'★'.repeat(stars(held.mastery)) || 'no stars yet'}` : ''}</span></> : <span className="text-white/40">Empty</span>}</span>
                <button type="button" data-assign={postKey(p)} className={btn} onClick={() => setPicking(picking && postKey(picking) === postKey(p) ? null : p)}>Assign</button>
              </div>
              <div className="text-white/50">{def.does} · best {def.bands.join(' or ')}{def.role ? ` · ${def.role}: ${def.perk}` : ''}</div>
              {picking && postKey(picking) === postKey(p) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {h && <button type="button" className={btn} onClick={() => { void updateSave((s) => assignPost(s, h.outfit, null)); setPicking(null) }}>Off duty</button>}
                  {crew.map((v) => (
                    <button key={v.outfit} type="button" data-candidate={v.outfit} className={btn} onClick={() => { void updateSave((s) => assignPost(s, v.outfit, p)); setPicking(null) }}>
                      {v.name} <AptitudeMark level={aptitude(p.kind, v.bands)} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-[12px] text-white/45">Aptitude: band 2 or less works at half, band 3 does the job, band 4–5 adds the extra. Running style: a Front Runner is full at once; a Pace Chaser never halves when deployed; a Late Surger gains half again from her third watch; an End Closer grows 10% a watch to half again. Stars at 3, 8 and 15 watches add 10% each. An Uma deployed in the battle that ends the watch works at half.</p>
    </div>
  )
}
