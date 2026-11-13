// Her message after a battle (CY13, TC56): one line from a small generic pool, picked from her outfit id and the watch so
// it stays put, worded to read right after a win or a loss. The story can give an Uma her own lines later. Plain and
// nameless, so in git.
const LINES = [
  'I keep replaying that fight. I know what I’d do differently.', 'My rig needs a polish after that one.', 'Same time next watch, {captain}?',
  'Thanks for the call out there.', 'Did you see that last move? Tell me you saw it.', 'Give me a watch to rest, then I’m ready again.',
  'We came back together. That’s the part I care about.', 'I want another go at that map.', 'You kept your head. It helped mine.',
]

export const messageFor = (outfit: number, watch: number): string => LINES[(outfit * 31 + watch * 7) % LINES.length]!
