// The story's state in the save (CY9, save v2): flags, Leads, the Log Files' filled lines, the Anomalies and the scenes
// seen, with pure functions to change it. Lists stay sorted, so a save is the same however it got there.
export interface StoryState {
  flags: string[]
  leads: string[]
  /** Each Log File's filled lines, by index. */
  files: Record<string, number[]>
  /** Each Anomaly: open (true) or closed (false). */
  anomalies: Record<string, boolean>
  seen: string[]
}

export const emptyStory = (): StoryState => ({ flags: [], leads: [], files: {}, anomalies: {}, seen: [] })

const add = (list: readonly string[], item: string): string[] => (list.includes(item) ? [...list] : [...list, item].sort())
const drop = (list: readonly string[], item: string): string[] => list.filter((x) => x !== item)

export const setFlag = (s: StoryState, flag: string, set = true): StoryState => ({ ...s, flags: set ? add(s.flags, flag) : drop(s.flags, flag) })
export const gainLead = (s: StoryState, lead: string): StoryState => ({ ...s, leads: add(s.leads, lead) })
export const fillFile = (s: StoryState, file: string, line: number): StoryState => {
  const lines = s.files[file] ?? []
  return lines.includes(line) ? s : { ...s, files: { ...s.files, [file]: [...lines, line].sort((a, b) => a - b) } }
}
export const setAnomaly = (s: StoryState, anomaly: string, open: boolean): StoryState => ({ ...s, anomalies: { ...s.anomalies, [anomaly]: open } })
export const seeScene = (s: StoryState, scene: string): StoryState => ({ ...s, seen: add(s.seen, scene) })
export const hasFlag = (s: StoryState, flag: string): boolean => s.flags.includes(flag)
export const hasSeen = (s: StoryState, scene: string): boolean => s.seen.includes(scene)
