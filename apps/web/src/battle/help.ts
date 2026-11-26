import type { Act, Objective, TileStateKind, UnitState, UnitStatus } from '@cyber/battle'
import type { CommandAction } from '@cyber/domain'

type HelpTopic = readonly [title: string, rule: string, since?: number]
const topics = {
  defeatAll: ['Clear the opposition', 'Win by taking every active opponent out of the fight.'],
  defeatLeader: ['Defeat the leader', 'Break the marked enemy leader’s Core. The mission may end while other enemies remain.'],
  reach: ['Reach the objective', 'Move a friendly unit onto the marked tile. Some missions require that tile even after the opposition falls.'],
  hold: ['Hold', 'Keep the squad standing through the required number of rounds. The briefing shows the target.'],
  escort: ['Escort', 'Keep the protected unit alive and get it to the marked destination.', 2],
  hack: ['Hack terminals', 'Use the Deck’s terminal action at the marked terminals. Some operations require a specific terminal last.', 2],
  freeLeader: ['Free the leader', 'Release the marked opponent from the Hold. The briefing says when breaking the Collar through Rig Break is required.', 2],
  protect: ['Keep the target active', 'Keep each named protected unit standing until the operation resolves.', 7],
  timeline: ['Turn order', 'Speed fills the action clock. The timeline shows upcoming activations and shifts after the selected action.'],
  move: ['Movement', 'Tap an available tile to preview the path. Tap again to select it, then commit the action and facing. Height and obstacles change reach.'],
  direction: ['Facing and line of sight', 'Face toward threats to Guard and counter. Side and rear shots can be stronger. Height and obstacles affect line of sight.'],
  reachView: ['Enemy Reach', 'Show the tiles enemies can threaten on their next turns. Check the intended path before committing.'],
  charge: ['Charge', 'Charge pays for reactions and special actions. The forecast shows who spends or gains it. Wait can recover Charge.'],
  link: ['Link', 'Keep Link on to participate in eligible allied reactions. A reaction also needs reach and available Charge.'],
  aim: ['Aim and accuracy', 'Aim with a compatible visor to pick a part at an accuracy penalty. Forecast shows hit chance, damage and critical chance.'],
  parts: ['Core and parts', 'Zero Core causes Rig Break. Broken arms limit weapons and shields. Broken Legs reduce movement and remove evasion.'],
  armor: ['Bands and armor', 'Speed sets initiative and movement. Stamina sets HP, Power sets Load capacity and melee power, Guts resists hacks, and Wit helps accuracy and hacks. Gear and earned armor modify the sortie values.'],
  capacity: ['Load and Capacity', 'Weapons and armor add Load. Deploy at or below Capacity. At 70% Load or less the rig gains one Move.'],
  equipment: ['Fitting equipment', 'Heavy or two-handed weapons use the right slot and clear the left hand. Long weapons fire from a Back launcher. Coats halve damage of their listed type.'],
  ammo: ['Ammo', 'A mounted launcher spends a round when fired. Inspect remaining ammo before committing the shot.'],
  damage: ['Damage types', 'Pierce, Impact and Fire interact with Coats. Impact can stun on a Core hit in supported rules. Fire affects eligible terrain.', 2],
  guard: ['Guard', 'A working shield may reduce incoming damage. Facing and part condition determine whether it can Guard.'],
  cover: ['Cover', 'An eligible linked ally can intercept an incoming attack. The forecast names the actual recipient.'],
  counter: ['Counter', 'A defender with an eligible weapon and Charge may shoot back if the attacker is within reach.'],
  crossfire: ['Crossfire', 'Eligible linked allies can follow an attack with their fitted weapon. The forecast lists each joining strike.'],
  forecast: ['Forecast', 'Check hit, damage, likely part breaks, reactions and Charge before committing. A forecast shows chance and legal recipients.'],
  active: ['Active', 'This rig is on the field and can act when its turn comes.'],
  down: ['Rig Break', 'The rig is down and can be rebooted until its recovery window closes. Inspect the timeline to see when it comes up next.'],
  out: ['Out of action', 'The unit has left the fight. A reboot requires a unit still down on the board.'],
  freed: ['Freed', 'The unit left combat after a release. The mission records the actual release method.', 2],
  stunned: ['Stunned', 'The unit loses its next activation.', 2],
  reloading: ['Reloading', 'This enemy cannot counter until its next turn while it reloads.', 2],
  pinned: ['Pinned', 'Accuracy is reduced by 10 percentage points until the unit’s next turn.', 2],
  suppressed: ['Suppressed', 'Cover, Counter and Crossfire are blocked until the unit’s next activation. Suppression also cancels a prepared shot.', 5],
  windup: ['Prepared enemy shot', 'A stronger follow-up is aimed at the named target. Move out of its threat or stop it with suppression.', 5],
  holdHp: ['Hold and Collar', 'The Hold has its own HP. The objective determines how to release or secure the leader.', 2],
  talk: ['Talk', 'Use the named actor who meets the target’s contact condition. The forecast shows whether Talk is available.', 5],
  signature: ['Signature mark', 'A signature attack marks a tile. Inspect the threat and move the target before its window closes.', 6],
  volley: ['Volley', 'The enemy marks tiles before the volley. Leave them before the marked strike.', 2],
  terrain: ['Terrain', 'Long-press a tile to see height, surface, effects and anything that can change it.', 2],
  wet: ['Wet', 'Wet puts out Fire and can carry electricity from a connected source.', 2],
  oil: ['Oil', 'Oil can catch Fire from flame or live current. Connected Oil can burn together.', 2],
  fire: ['Fire', 'A burning tile damages units and can ignite adjacent Oil. Wet puts it out.', 2],
  smoke: ['Smoke', 'Smoke interferes with ranged attacks. The tile card shows how long it lasts.', 2],
  live: ['Live current', 'Cables can energize connected Wet tiles and grating. Inspect the tile before crossing.', 2],
  props: ['Props and terminals', 'Pipes, barrels and cables change terrain. Terminals switch linked doors, lifts, turrets or lights.', 2],
  barrier: ['Barrier', 'A Bulwark places a barrier. It changes access or protection until destroyed.', 2],
  mend: ['Mend', 'Use a Med unit to restore an eligible part. Select the target and part in the forecast.', 2],
  reboot: ['Reboot', 'Use an eligible action on a downed teammate before she leaves the field.', 2],
  patch: ['Emergency Patch', 'The Heal subclass restores up to 6 Core to self or an adjacent ally before moving. It costs 1 Charge and works once per battle.', 5],
  tech: ['Tech', 'A working Deck provides terminal and hack actions. Refer to the forecast for the actual chance and target.', 2],
  item: ['Items', 'Items use the available battle stock. Inspect the selected target and effect before committing.', 2],
  order: ['Captain orders', 'The ship’s available support, targets and uses are listed under More.', 3],
  wait: ['Wait', 'End the turn without an attack. Waiting can recover Charge and change the next activation.'],
  controls: ['Battle controls', 'Select a move and action, review the forecast, then confirm. Undo clears an uncommitted choice. Auto turn and Auto face are available on supported formations.'],
  results: ['Results and retry', 'Debrief records a verified victory. Retry starts the same frozen battle. An eligible first story clear pays XP once.'],
  laser: ['Laser modes', 'The two-handed Laser uses Focused from R1, Thermal at R2, Impact at R3 and Area at R5. Alternative modes add 1 Charge. Reactions use the fitted weapon.', 5],
  thermal: ['Thermal', 'Two Fire pulses. An eligible tile or prop can ignite when hit.', 5],
  impact: ['Impact', 'Two Impact pulses. A hit can drain 1 Charge from the actual recipient.', 5],
  area: ['Area', 'A Pierce attack from 2–3 tiles. A hit splashes eligible adjacent enemies.', 5],
  suppress: ['Suppress', 'A Sniper spends 2 Charge and one round. A hit blocks reactions and can cancel prepared attacks in the target’s area.', 5],
  subclass: ['Uma subclasses', 'Heal patches Core, Shield adds a reduced barrier, Melee offers a two-handed blade, Long Range adds a reduced Back weapon, and Support adds a Deck. On her expedition launch the Uma becomes Laser-only.', 5],
  roles: ['Expedition roles', 'Two Laser Umas and two winged melee allies deal damage. Shields intercept, Medics repair, and Snipers interrupt and block reactions.', 7],
  xp: ['XP and armor milestones', 'Eligible participants earn XP once per story battle. Level milestones improve effective armor on new sorties. Laser Rank follows separate ground clear rules.'],
  readiness: ['Recommended levels', 'The level is a preparation target for issued gear and the required party. The briefing shows the actual objective and conditions.'],
  salvage: ['Salvage and Alloy', 'Repeat salvage for Hangar Alloy and first-clear recipes. Ship Alloy funds station and cutter work. Salvage gives gear materials and uses a calendar watch on launch.'],
  bridge: ['Bridge stations', 'Assign available officers to the four stations. Their drills strengthen the orders tied to each station.'],
  shipPower: ['Reactor power', 'Allocate power to shields, guns and fighters. Review the next threat and keep the total within current reactor power.'],
  shipThreat: ['Incoming wave', 'The panel shows the threatened section, direct fire and incoming fighters. Shields absorb direct fire. Interception protects the escorted target.'],
  shipHull: ['Hull and objective', 'Keep the ship and the escorted objective intact. Read the briefing for the encounter’s win condition and the threat schedule.'],
  emitter: ['Shield emitter', 'Target the emitter when the encounter allows it. Some approach objectives require disabling it before victory.'],
  evade: ['Evade', 'Reduce incoming direct fire. The pilot’s drills improve the maneuver.'],
  brace: ['Brace shields', 'Reinforce the threatened shield section. The shields officer improves the block.'],
  fireOrder: ['Fire guns', 'Spend assigned gun power on the enemy ship or an eligible target.'],
  intercept: ['Intercept', 'Use fighters to reduce attacks on the protected objective.'],
  strike: ['Fighter strike', 'Send fighters against an eligible ship target or shield emitter.'],
  reroute: ['Reroute power', 'Engineering prepares extra power for a later order.'],
  supplies: ['Sortie supplies', 'Launching charges the listed fuel and provisions. The frozen attempt supports retry with the existing committed costs.'],
} satisfies Record<string, HelpTopic>

export type BattleTopic = keyof typeof topics
export const battleHelp: Readonly<Record<BattleTopic, HelpTopic>> = topics

export const objectiveTopics = {
  defeatAll: 'defeatAll', defeatLeader: 'defeatLeader', reach: 'reach', hold: 'hold', escort: 'escort', hack: 'hack', freeLeader: 'freeLeader',
} as const satisfies Record<Objective['kind'], BattleTopic>

export const orderTopics = {
  evade: 'evade', brace: 'brace', fire: 'fireOrder', intercept: 'intercept', strike: 'strike', reroute: 'reroute',
} as const satisfies Record<CommandAction['order'], BattleTopic>

export const tileTopics = { wet: 'wet', oil: 'oil', fire: 'fire', smoke: 'smoke' } as const satisfies Record<TileStateKind, BattleTopic>
const statusTopics = { active: 'active', down: 'down', out: 'out', freed: 'freed' } as const satisfies Record<UnitStatus, BattleTopic>

export function unitHelpTopics(unit: UnitState): BattleTopic[] {
  const statuses = ['stunned', 'reloading', 'pinned', 'suppressed', 'windup', 'holdHp'] as const
  return [statusTopics[unit.status], ...statuses.filter(status => !!unit[status]), ...(unit.signatureMark ? ['signature' as const] : [])]
}

export function actionHelpTopic(action: Act): BattleTopic {
  switch (action.kind) {
    case 'attack': return action.mode ?? (action.aim ? 'aim' : 'forecast')
    case 'talk': return 'talk'
    case 'barrier': return 'barrier'
    case 'mend': return 'mend'
    case 'reboot': return 'reboot'
    case 'item': return 'item'
    case 'tech': return 'tech'
    case 'wait': return 'wait'
    default: return 'controls'
  }
}
