// The invented stand-in story (CY9), in git: one world, one lead's Chapter 1 with its debrief, one Log File and one Call,
// enough to use every step kind once. Invented ids in uma-farm's style (Umas 9000001–9000004, the heroine `stand-in-1`,
// slugs `sw1-…`) and plain labels, never a name. The game falls back to it until the story session's files are served.
const LEAD = 9000001

export const STAND_IN_FILES: Record<string, unknown> = {
  'casting.json': {
    schemaVersion: 1, layer: 'placeholder',
    leads: [{ outfit: LEAD, world: 'sw1', opens: 'comms', talent: 'stand-in-talent' }, { outfit: 9000002, world: 'sw2', opens: 'store' }],
    crewOrder: [LEAD, 9000002, 9000003, 9000004],
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
    schemaVersion: 1, id: 'sw2', layer: 'skeleton', factions: ['steel-muster'], x: 70, y: 35,
    locations: [{ id: 'sw2-gate', danger: 2, needs: ['chapter:sw1-ch1'], x: 50, y: 50 }],
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
