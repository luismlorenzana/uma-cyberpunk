// The captain (CY13, TC55): the player, named at a new game, with the pronouns they pick (they by default), never drawn.
// Scene text says {captain} and {they}, {them}, {their}, {theirs}, {they're} (capitalised forms too), filled from the
// save, so one line reads right for every captain. The Romance setting (TC56): Ask, or Friends only.
export type Pronouns = 'they' | 'she' | 'he'
export const PRONOUNS: readonly Pronouns[] = ['they', 'she', 'he']
export type Romance = 'ask' | 'friends'
export const ROMANCE: readonly Romance[] = ['ask', 'friends']

export interface Captain {
  name: string
  pronouns: Pronouns
  romance: Romance
  /** Whether the player has named the captain yet: a new game, or a save from before CY13, asks once. */
  named: boolean
}

export const CAPTAIN_NAME_MAX = 24
export const DEFAULT_CAPTAIN: Captain = { name: 'Captain', pronouns: 'they', romance: 'ask', named: false }

const FORMS: Record<Pronouns, Record<'they' | 'them' | 'their' | 'theirs' | "they're", string>> = {
  they: { they: 'they', them: 'them', their: 'their', theirs: 'theirs', "they're": "they're" },
  she: { they: 'she', them: 'her', their: 'her', theirs: 'hers', "they're": "she's" },
  he: { they: 'he', them: 'him', their: 'his', theirs: 'his', "they're": "he's" },
}

/** A name as the captain screen keeps it: trimmed, at most 24 characters, never empty. */
export const captainName = (raw: string): string => raw.trim().slice(0, CAPTAIN_NAME_MAX) || DEFAULT_CAPTAIN.name

/** Scene text with the captain's name and pronouns filled in. */
export function fillCaptain(text: string, captain: Pick<Captain, 'name' | 'pronouns'>): string {
  return text.replace(/\{(captain|they're|theirs|their|them|they)\}/gi, (whole, word: string) => {
    if (word.toLowerCase() === 'captain') return captain.name
    const form = FORMS[captain.pronouns][word.toLowerCase() as keyof (typeof FORMS)['they']]
    return word[0] === word[0]!.toUpperCase() ? form[0]!.toUpperCase() + form.slice(1) : form
  })
}
