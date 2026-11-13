// The story's format (CY9, the story brief's §8 content contract, SB8): what the story session writes in content/stories/
// and the game reads. Ids: an Uma by her outfit id, a heroine by her board id, everything else by a lowercase slug.
// Names, busts and portraits come from master data at run time, never from these files.
import type { Role } from '@cyber/battle'

/** Who speaks: an Uma's outfit id, or a heroine's board id or a minor character's slug. */
export type Speaker = number | string
export type Layer = 'placeholder' | 'skeleton' | 'bible' | 'scripted' | 'published'
export const LAYERS: readonly Layer[] = ['placeholder', 'skeleton', 'bible', 'scripted', 'published']

export type Step =
  | { kind: 'line'; speaker: Speaker; text: string }
  /** An interjection slot (TC51): a line for each lead who might be in the squad, keyed by outfit id, and a fallback. */
  | { kind: 'slot'; lines: Record<string, string>; fallback: string }
  | { kind: 'narrate'; text: string }
  | { kind: 'thought'; speaker: Speaker; text: string }
  | { kind: 'emote'; actor: Speaker; emote: string }
  | { kind: 'wait'; ms: number }
  | { kind: 'choice'; options: ChoiceOption[] }
  | { kind: 'flag'; flag: string; set: boolean }
  | { kind: 'lead'; lead: string }
  /** Fills in a Log File's line. */
  | { kind: 'file'; file: string; line: number }
  | { kind: 'anomaly'; anomaly: string; open: boolean }
  /** A crew Uma comes aboard. */
  | { kind: 'join'; outfit: number }
  /** The lead comes aboard: Chapter 1's last step. */
  | { kind: 'aboard'; outfit: number }
  | { kind: 'call'; call: string }
  /** Plays a mission of the same chapter. */
  | { kind: 'battle'; mission: string }
  /** The captain's choice (CY13, TC55): two or three lines in a tone, each with the rapport it earns. */
  | { kind: 'captain'; options: CaptainOption[] }
  /** Trust or Heart (CY13, TC56): only in a bond scene at rank 8 (or 10, to change it), after she says what she hopes for. */
  | { kind: 'path'; trust: Step[]; heart: Step[] }
export type StepKind = Step['kind']
export const STEP_KINDS: readonly StepKind[] = ['line', 'slot', 'narrate', 'thought', 'emote', 'wait', 'choice', 'flag', 'lead', 'file', 'anomaly', 'join', 'aboard', 'call', 'battle', 'captain', 'path']

export interface ChoiceOption { text: string; lead?: string; then: Step[] }

export type Tone = 'warm' | 'steady' | 'wry'
export const TONES: readonly Tone[] = ['warm', 'steady', 'wry']
export interface CaptainOption { tone: Tone; text: string; rapport: number; then: Step[] }

/** A bond scene (CY13, TC57): at a rank, in her cabin or a ship spot. */
export interface BondScene { rank: number; place: string; steps: Step[] }
/** Her bond scenes, `bonds/<outfit>.json`, and her epilogue card once she reaches rank 10. */
export interface BondFile { schemaVersion: 1; outfit: number; scenes: BondScene[]; epilogue?: string; layer?: Layer }

export type Trigger = { arrive: string } | { after: string } | { talk: string }

export interface CastMember { outfit?: number; heroine?: string; minor?: string }

export interface Scene { id: string; place: string; trigger: Trigger; cast: CastMember[]; steps: Step[] }

export type MissionObjective = 'defeat-all' | 'defeat-leader' | 'free-leader' | 'reach' | 'hold' | 'escort' | 'hack'
export const MISSION_OBJECTIVES: readonly MissionObjective[] = ['defeat-all', 'defeat-leader', 'free-leader', 'reach', 'hold', 'escort', 'hack']

export type EnemySlot =
  | { slot: 'boss'; pool: string[] }
  | { slot: 'regular'; job: string; count: number; faction: string }

export interface Mission {
  id: string
  place: string
  objective: { kind: MissionObjective }
  /** What the map looks like, for the game session to build. */
  brief: string
  enemies: EnemySlot[]
  /** A flash-forward's fixed squad (TC32), or null. */
  fixedSquad: number[] | null
  side: { kind: string; gives: string }[]
  /** The scenario the game built for it (the game's, in scenarios/). */
  scenario?: string
}

export interface Chapter {
  schemaVersion: 1
  id: string
  world: string
  leads: number[]
  /** 1: her Chapter 1, which ends with `aboard`. */
  number: number
  /** The recommended squad level. */
  danger: number
  /** Keys: `chapter:…`, `mission:…`, `file:…`. */
  needs: string[]
  scenes: Scene[]
  missions: Mission[]
  debrief: { steps: Step[] }
  layer?: Layer
}

export interface Location { id: string; danger: number; needs: string[]; links: string[]; x?: number; y?: number }

export interface World { schemaVersion: 1; id: string; look?: string; mood?: string; locations: Location[]; factions: string[]; layer?: Layer; x?: number; y?: number }

export interface Lead { outfit: number; world: string; opens?: string; talent?: string }

export interface Casting {
  schemaVersion: 1
  leads: Lead[]
  /** The order the squad's interjection slots prefer, by outfit id. */
  crewOrder: number[]
  /** Each Uma's authored role (TC5), by outfit id; one untagged falls back to her running style (CY11). */
  roles?: Record<string, Role>
  /** The keys bond ranks 4, 6, 8 and 10 wait on (CY13), in the `needs` syntax; a rank not named is open. */
  bondGates?: Record<string, string>
  heroines: { board: string; faction: string; hold: 'anchor' | 'collar' | 'none' }[]
  minor: string[]
  /** Stand-in only: plain labels for invented ids, since no name comes from master data for them. */
  labels?: Record<string, string>
  layer?: Layer
}

export interface LogFile { schemaVersion: 1; id: string; world?: string; lines: { text: string; redacted: boolean }[]; layer?: Layer }

export interface Call { schemaVersion: 1; id: string; question: string; voters: { outfit: number; argument: string }[]; branches: { id: string; text: string; then: Step[] }[]; layer?: Layer }

/** Everything the game plays, by id. */
export interface StoryPack {
  casting: Casting
  worlds: Record<string, World>
  chapters: Record<string, Chapter>
  files: Record<string, LogFile>
  calls: Record<string, Call>
  /** Bond scenes by outfit id (CY13). */
  bonds: Record<string, BondFile>
}
