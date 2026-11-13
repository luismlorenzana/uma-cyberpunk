// The captain screen (CY13, TC55): a new game, or a save from before CY13, names the captain once: a name, pronouns (they
// by default) and the Romance setting. The captain is never drawn. Account changes all three later (CaptainFields).
import { CAPTAIN_NAME_MAX, captainName, PRONOUNS, type Captain, type Pronouns, type Romance } from '@cyber/domain'
import { useState } from 'react'

const PRONOUN_WORDS: Record<Pronouns, string> = { they: 'They / them', she: 'She / her', he: 'He / him' }
const ROMANCE_WORDS: Record<Romance, { name: string; does: string }> = {
  ask: { name: 'Ask', does: 'At a bond’s rank 8, each Uma says what she hopes for, and you choose Trust or Heart' },
  friends: { name: 'Friends only', does: 'Every bond grows as Trust: partners in arms, never romance' },
}

/** The three fields, for the setup screen and Account. */
export function CaptainFields({ value, onChange }: { value: Pick<Captain, 'name' | 'pronouns' | 'romance'>; onChange: (v: Pick<Captain, 'name' | 'pronouns' | 'romance'>) => void }) {
  const chip = (on: boolean) => `min-h-11 rounded-md px-3 text-[14px] font-semibold ${on ? 'bg-[#2ee6ff] text-[#0b0d17]' : 'bg-white/10 text-[#e8ebf5]'}`
  return (
    <div className="space-y-3">
      <label className="block text-[13px] text-white/70">Name
        <input data-captain-name value={value.name} maxLength={CAPTAIN_NAME_MAX} onChange={(e) => onChange({ ...value, name: e.target.value })}
          className="mt-1 block min-h-11 w-full rounded-md bg-[#0b0d17] px-3 text-[16px] text-[#e8ebf5] ring-1 ring-white/15" />
      </label>
      <div className="text-[13px] text-white/70">Pronouns
        <div className="mt-1 flex flex-wrap gap-2">{PRONOUNS.map((p) => <button key={p} type="button" data-pronouns={p} aria-pressed={value.pronouns === p} onClick={() => onChange({ ...value, pronouns: p })} className={chip(value.pronouns === p)}>{PRONOUN_WORDS[p]}</button>)}</div>
      </div>
      <div className="text-[13px] text-white/70">Romance
        <div className="mt-1 flex flex-wrap gap-2">{(['ask', 'friends'] as const).map((r) => <button key={r} type="button" data-romance={r} aria-pressed={value.romance === r} onClick={() => onChange({ ...value, romance: r })} className={chip(value.romance === r)}>{ROMANCE_WORDS[r].name}</button>)}</div>
        <div className="mt-1 text-[12px] text-white/50">{ROMANCE_WORDS[value.romance].does}. Friendship and romance are equal in battle.</div>
      </div>
    </div>
  )
}

export function CaptainSetup({ initial, onDone }: { initial: Captain; onDone: (captain: Captain) => void }) {
  const [value, setValue] = useState({ name: initial.named ? initial.name : '', pronouns: initial.pronouns, romance: initial.romance })
  return (
    <div data-captain-setup className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b0d17]/95 p-4 text-[#e8ebf5]">
      <div className="w-full max-w-lg space-y-4 rounded-xl bg-[#141827] p-5 ring-1 ring-white/15">
        <div>
          <div className="text-[12px] uppercase tracking-widest text-white/50">The ship's log, first entry</div>
          <h1 className="font-display text-2xl font-bold">Who commands this ship?</h1>
          <p className="text-[13px] text-white/60">You are the captain: every Uma aboard answers to you, and you look after every one of them.</p>
        </div>
        <CaptainFields value={value} onChange={setValue} />
        <button type="button" data-take-command onClick={() => onDone({ ...value, name: captainName(value.name), named: true })}
          className="min-h-12 w-full rounded-md bg-[#2ee6ff] font-display text-[16px] font-bold text-[#0b0d17]">Take command</button>
      </div>
    </div>
  )
}
