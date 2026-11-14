// The lines a visit says when the story writes none (CY14): the stand-in pool, invented, in git. A module of its own so
// the main bundle, which needs the cabins' rules for resting, doesn't carry the lines (only the cabin screens do).
import type { Style, Topic } from './items'

const hash = (n: number, salt: number): number => {
  let h = (n ^ (salt * 0x9e3779b1)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}


/** The stand-in pool (invented, in git): a line for each topic, said in her own cabin. {item} is a piece in the cabin. */
export const TOPIC_LINES: Record<Topic, readonly string[]> = {
  racing: ['I still count strides when I walk the corridors.', 'Out there, the only thing that matters is the next corner.'],
  music: ['I keep a song for every jump. This one is for tonight.', 'The engines hum in a key. Did you know?'],
  food: ['The Galley ran out of the good noodles again.', 'Something warm after a mission fixes most things.'],
  fashion: ['If we have to fight, we may as well look sharp doing it.', 'I re-stitched my jacket. Can you tell?'],
  tech: ['I took the console apart. It works better now. Mostly.', 'Every system aboard talks, if you listen.'],
  stars: ['I name the stars we pass. Some of them twice.', 'From here the city lights look like stars too.'],
  home: ['Some nights I forget where home was. Then it comes back.', 'This cabin is starting to feel like mine.'],
  training: ['Same drills every morning. It keeps me honest.', 'My legs are sore. That means it worked.'],
  games: ['One more round. I almost had you last time.', 'I keep a tally of our card games. You’re losing.'],
  nature: ['I miss rain. Real rain, not the hull sweating.', 'There’s a plant in the Galley nobody waters but me.'],
  history: ['Every world we visit was something else once.', 'I read the old logs. Captains before you had it hard.'],
  crew: ['The others are louder when you’re not around.', 'We look out for each other. You taught us that.'],
}
export const OTHER_LINES: readonly string[] = ['Hm. I hadn’t thought about it like that.', 'Sure, we can talk about that.', 'You always find something to ask.']
export const INVITE_LINES: readonly string[] = [
  'The Observation Deck was empty. The stars did all the talking.',
  'She pointed out the world we just left, small as a coin.',
  'For a few minutes, there was no mission. Just the window.',
]
export const DECORATE_LINES: Record<Style, string> = {
  neon: 'Something that glows. I like a room that keeps the lights on.', classic: 'Something solid. It feels like it’ll last.',
  cozy: 'Something soft. I sleep better with it.', sporty: 'Something to train with. Rest days are hard.',
  tech: 'Something I can tinker with.', wild: 'Something alive, or close to it.',
}
export const KEEPSAKE_LINE = 'This one stays where I can see it.'

/** A talk's lines: her written small talk on the topic, else the pool's; one of them picked by the visit. */
export function talkLine(topic: Topic, written: Partial<Record<Topic, readonly string[]>> | undefined, loved: boolean, seed: number): string {
  const lines = written?.[topic]?.length ? written[topic]! : loved ? TOPIC_LINES[topic] : OTHER_LINES
  return lines[hash(seed, 13) % lines.length]!
}
