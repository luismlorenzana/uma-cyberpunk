// The invented stand-in story (CY9, CY12), in git: two worlds and two leads' Chapter 1s, each with a battle, an
// interjection slot, a crew Uma who joins and a debrief, two Log Files and a Call; every step kind is used. CY12's loop
// plays it end to end: Lead A's Chapter 1 on World sw1, her pickup and room, the jump to sw2, Lead B's, and hers. Invented ids in uma-farm's style (Umas 9000001–9000004, the heroine `stand-in-1`,
// slugs `sw1-…`) and plain labels, never a name. The game falls back to it until the story session's files are served.
const LEAD = 9000001

export const STAND_IN_FILES: Record<string, unknown> = {
  'casting.json': {
    schemaVersion: 1, layer: 'placeholder',
    leads: [{ outfit: LEAD, world: 'sw1', opens: 'comms', talent: 'stand-in-talent' }, { outfit: 9000002, world: 'sw2', opens: 'store' }],
    crewOrder: [LEAD, 9000002, 9000003, 9000004],
    roles: { '9000001': 'striker', '9000002': 'medic' },
    bondGates: { '4': 'chapter:sw1-ch1', '6': 'chapter:sw2-ch1' },
    tastes: {
      '9000001': { favourite: 'sporty', disliked: 'cozy', gift: 'snacks', topics: ['racing', 'food'] },
      '9000002': { favourite: 'cozy', disliked: 'sporty', gift: 'books', topics: ['history', 'crew'] },
      '9000003': { favourite: 'tech', disliked: 'wild', gift: 'gear', topics: ['tech', 'training'] },
      '9000004': { favourite: 'wild', disliked: 'tech', gift: 'plants', topics: ['nature', 'stars'] },
    },
    heroines: [{ board: 'stand-in-1', faction: 'steel-muster', hold: 'collar' }],
    minor: ['sw1-dockhand'],
    labels: { '9000001': 'Lead A', '9000002': 'Lead B', '9000003': 'Crew C', '9000004': 'Crew D', 'stand-in-1': 'Heroine A', 'sw1-dockhand': 'Dockhand' },
  },
  'worlds/sw1.json': {
    schemaVersion: 1, id: 'sw1', look: 'A stand-in world: a ring of docks under a dark sky.', mood: 'Quiet before the alarm.', factions: ['steel-muster'], x: 30, y: 55,
    locations: [
      { id: 'sw1-docks', danger: 1, links: ['sw1-market'], x: 20, y: 70 },
      { id: 'sw1-market', danger: 1, links: ['sw1-docks', 'sw1-underlevels'], x: 45, y: 50 },
      { id: 'sw1-underlevels', danger: 2, needs: ['file:sw1-file-1'], links: ['sw1-market'], x: 70, y: 30 },
    ],
  },
  'worlds/sw2.json': {
    schemaVersion: 1, id: 'sw2', look: 'A second stand-in world: terraced yards under a red sun.', mood: 'Hot wind and loud machines.', factions: ['steel-muster'], x: 70, y: 35,
    locations: [
      { id: 'sw2-gate', danger: 2, needs: ['chapter:sw1-ch1'], links: ['sw2-yards'], x: 20, y: 65 },
      { id: 'sw2-yards', danger: 2, needs: ['chapter:sw1-ch1'], links: ['sw2-gate', 'sw2-spire'], x: 50, y: 45 },
      { id: 'sw2-spire', danger: 3, needs: ['mission:sw2-ch1-m1'], links: ['sw2-yards'], x: 80, y: 25 },
    ],
  },
  'chapters/sw1-ch1.json': {
    schemaVersion: 1, id: 'sw1-ch1', world: 'sw1', leads: [LEAD], number: 1, danger: 1, needs: [],
    scenes: [
      {
        id: 'sw1-ch1-s1', place: 'sw1-docks', trigger: { arrive: 'sw1-docks' }, cast: [{ outfit: LEAD }, { minor: 'sw1-dockhand' }],
        steps: [
          { narrate: 'The docks hum. Somewhere above, a siphon drinks the light.' },
          { line: { speaker: 'sw1-dockhand', text: "You're not on the manifest." } },
          { line: { speaker: LEAD, text: "I'm on the one that matters." } },
          { emote: { actor: LEAD, emote: 'smile' } },
          { slot: { lines: { '9000002': 'Lead B would have a sharper word for him.' }, fallback: 'The dockhand shrugs and steps aside.' } },
          { thought: { speaker: LEAD, text: 'Keep moving. The market first.' } },
          { wait: 400 },
          { choice: [
            { text: 'Ask about the alarm', lead: 'sw1-lead-alarm', then: [{ line: { speaker: 'sw1-dockhand', text: 'Third one this week. Nobody comes.' } }] },
            { text: 'Say nothing', then: [] },
          ] },
          { flag: 'sw1-met-dockhand' },
          { lead: 'sw1-lead-docks' },
        ],
      },
      {
        id: 'sw1-ch1-s2', place: 'sw1-market', trigger: { talk: 'sw1-market' }, cast: [{ outfit: LEAD }, { heroine: 'stand-in-1' }],
        steps: [
          { line: { speaker: 'stand-in-1', text: 'Turn back. This sector is closed.' } },
          { file: { file: 'sw1-file-1', line: 0 } },
          { anomaly: { anomaly: 'sw1-anomaly-light', open: true } },
          { battle: 'sw1-ch1-m1' },
        ],
      },
      {
        id: 'sw1-ch1-s3', place: 'sw1-market', trigger: { after: 'sw1-ch1-m1' }, cast: [{ outfit: LEAD }, { outfit: 9000003 }],
        steps: [
          { line: { speaker: 9000003, text: 'A ship, out past the ring. They say it takes anyone who can fight.' } },
          { join: 9000003 },
          { call: 'sw1-call-1' },
          { anomaly: { anomaly: 'sw1-anomaly-light', open: false } },
          { aboard: LEAD },
        ],
      },
    ],
    missions: [{
      id: 'sw1-ch1-m1', place: 'sw1-underlevels', objective: { kind: 'defeat-leader' },
      brief: 'The underlevels under the market: high ground at the back corners, an Oil slick under the enemy line, a door on a terminal.',
      enemies: [{ slot: 'boss', pool: ['stand-in-1'] }, { slot: 'regular', job: 'gunner', count: 5, faction: 'steel-muster' }],
      fixedSquad: null, side: [{ kind: 'hack', gives: 'sw1-lead-terminal' }], scenario: 'sandbox-muster',
    }],
    debrief: { steps: [{ line: { speaker: LEAD, text: 'So this is the ship. It smells like ozone and old coffee.' } }] },
  },
  'chapters/sw2-ch1.json': {
    schemaVersion: 1, id: 'sw2-ch1', world: 'sw2', leads: [9000002], number: 1, danger: 2, needs: ['chapter:sw1-ch1'],
    scenes: [
      {
        id: 'sw2-ch1-s1', place: 'sw2-gate', trigger: { arrive: 'sw2-gate' }, cast: [{ outfit: 9000002 }, { outfit: LEAD }],
        steps: [
          { narrate: 'The gate opens on a yard full of cranes. Someone is waiting under the nearest one.' },
          { line: { speaker: 9000002, text: "You're the ship everyone talks about. You're late." } },
          { slot: { lines: { [String(LEAD)]: 'Late is still here. Are you coming or not?' }, fallback: 'The crew trades a look and says nothing.' } },
          { lead: 'sw2-lead-gate' },
        ],
      },
      {
        id: 'sw2-ch1-s2', place: 'sw2-yards', trigger: { talk: 'sw2-yards' }, cast: [{ outfit: 9000002 }, { outfit: 9000004 }],
        steps: [
          { line: { speaker: 9000004, text: 'The yard boss keeps a drone pack on the terraces. I know the way up.' } },
          { join: 9000004 },
          { file: { file: 'sw2-file-1', line: 0 } },
          { battle: 'sw2-ch1-m1' },
        ],
      },
      {
        id: 'sw2-ch1-s3', place: 'sw2-yards', trigger: { after: 'sw2-ch1-m1' }, cast: [{ outfit: 9000002 }, { outfit: LEAD }],
        steps: [
          { slot: { lines: { [String(LEAD)]: 'Not bad. The ship could use someone who keeps us standing.' }, fallback: 'Lead B looks up at the ship for a long moment.' } },
          { line: { speaker: 9000002, text: 'Fine. Someone has to patch you all up.' } },
          { file: { file: 'sw2-file-1', line: 1 } },
          { aboard: 9000002 },
        ],
      },
    ],
    missions: [{
      id: 'sw2-ch1-m1', place: 'sw2-yards', objective: { kind: 'defeat-all' },
      brief: 'The terraced yards: the drone pack holds the high ground; the cranes give cover on the way up.',
      enemies: [{ slot: 'regular', job: 'gunner', count: 4, faction: 'steel-muster' }],
      fixedSquad: null, side: [], scenario: 'high-ground',
    }],
    debrief: { steps: [
      { line: { speaker: 9000002, text: 'A store aboard? Good. I need parts more than I need sleep.' } },
      { slot: { lines: { [String(LEAD)]: 'Welcome aboard. Bunks are wherever you fall asleep.' }, fallback: 'The ship hums under her feet.' } },
    ] },
  },
  'bonds/9000001.json': {
    schemaVersion: 1, outfit: LEAD,
    epilogue: 'Lead A still runs the ring docks at dawn, with {captain} keeping pace a step behind.',
    talk: {
      racing: ['I ran the ring docks every dawn before any of this. I still wake up for it.', 'Nobody beats me to the end of a corridor. Try it.'],
      food: ['The Galley’s noodles are a crime. I’m going to fix them myself.', 'Bring me something sweet after a mission and I’ll forgive anything.'],
    },
    scenes: [
      { rank: 2, place: 'cabin', steps: [
        { line: { speaker: LEAD, text: '{Captain}. You knock like you expect to be told no.' } },
        { captain: [
          { tone: 'warm', text: 'I wanted to see how you were settling in.', rapport: 20, then: [{ line: { speaker: LEAD, text: 'Settling. Slowly. The bunk is too soft.' } }] },
          { tone: 'steady', text: 'A status check. You fought hard today.', rapport: 10, then: [{ line: { speaker: LEAD, text: 'I always do. Ask me something harder.' } }] },
          { tone: 'wry', text: 'I lost a bet. I have to say goodnight to everyone.', rapport: 15, then: [{ emote: { actor: LEAD, emote: 'smile' } }] },
        ] },
        { line: { speaker: LEAD, text: 'Thanks for checking. Really.' } },
      ] },
      { rank: 4, place: 'observation-deck', steps: [
        { narrate: 'The stars wheel past the glass. Lead A watches them like a track.' },
        { line: { speaker: LEAD, text: 'Back home I ran the dock rings every morning. Here I just run in circles.' } },
        { captain: [
          { tone: 'warm', text: 'Then run them with me tomorrow.', rapport: 25 },
          { tone: 'steady', text: 'The Sim Pod has a track. I can get you time on it.', rapport: 15 },
        ] },
      ] },
      { rank: 6, place: 'galley', steps: [
        { line: { speaker: LEAD, text: 'I cooked. Do not say anything about the smoke.' } },
        { captain: [
          { tone: 'wry', text: 'What smoke?', rapport: 20 },
          { tone: 'warm', text: 'It smells like home. Someone\'s home, anyway.', rapport: 25 },
        ] },
      ] },
      { rank: 8, place: 'cabin', steps: [
        { line: { speaker: LEAD, text: 'Can I say something without you being the captain for a minute?' } },
        { line: { speaker: LEAD, text: 'I like who I am when you\'re around. I don\'t know what to call that yet.' } },
        { path: {
          trust: [{ line: { speaker: LEAD, text: 'Partners, then. The kind who always come back for each other.' } }],
          heart: [{ line: { speaker: LEAD, text: 'Then let me call it something. Will you walk the deck with me tonight?' } }],
        } },
      ] },
      { rank: 10, place: 'observation-deck', steps: [
        { line: { speaker: LEAD, text: 'Whatever is out there, I\'d rather meet it next to {them}. Next to you.' } },
        { captain: [{ tone: 'warm', text: 'Always.', rapport: 0 }, { tone: 'steady', text: 'Then we meet it together.', rapport: 0 }] },
      ] },
    ],
  },
  'bonds/9000002.json': {
    schemaVersion: 1, outfit: 9000002,
    epilogue: 'Lead B keeps the med bay stocked and the captain honest, which she says is the harder job.',
    scenes: [
      { rank: 2, place: 'cabin', steps: [
        { line: { speaker: 9000002, text: 'If you\'re here for a checkup, sit. If not, sit anyway.' } },
        { captain: [
          { tone: 'steady', text: 'I\'m here to see how the medic is doing.', rapport: 20 },
          { tone: 'wry', text: 'I\'ll take the checkup. I trust your aim.', rapport: 15 },
        ] },
      ] },
      { rank: 8, place: 'garden', steps: [
        { line: { speaker: 9000002, text: 'I patch everyone up. Nobody asks who patches me.' } },
        { line: { speaker: 9000002, text: 'You did. I noticed.' } },
        { path: {
          trust: [{ line: { speaker: 9000002, text: 'Good. Keep asking. I\'ll keep answering.' } }],
          heart: [{ line: { speaker: 9000002, text: 'Then stay a while. The garden is quiet at this hour.' } }],
        } },
      ] },
    ],
  },
  'log/sw2-file-1.json': {
    schemaVersion: 1, id: 'sw2-file-1', world: 'sw2',
    lines: [{ text: 'Yard drones re-tasked to the spire. Authority: [redacted].', redacted: true }, { text: 'The spire lights answer the ones in the old Gate.', redacted: false }],
  },
  'log/sw1-file-1.json': {
    schemaVersion: 1, id: 'sw1-file-1', world: 'sw1',
    lines: [{ text: 'Siphon output down eleven percent. Cause: [redacted].', redacted: true }, { text: 'Night shift reports lights in the old Gate.', redacted: false }],
  },
  'calls/sw1-call-1.json': {
    schemaVersion: 1, id: 'sw1-call-1', question: 'Take the ship, or stay and guard the docks?',
    voters: [{ outfit: LEAD, argument: 'The answer is out there, not here.' }],
    branches: [{ id: 'sw1-call-1-go', text: 'Take the ship', then: [{ flag: 'sw1-took-ship' }] }, { id: 'sw1-call-1-stay', text: 'Stay a while', then: [{ flag: 'sw1-stayed' }] }],
  },
}
