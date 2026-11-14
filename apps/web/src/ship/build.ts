// The ship as a build between the screens and the save (CY15): placing and upgrading modules, the Lab's project and the
// sortie's power choice, each a pure step on the save (the rules are the domain's hull).
import { placeModule, powerChoice, startResearch, upgradeModule, type ModuleId, type Save, type SystemId } from '@cyber/domain'

export function placeOnShip(save: Save, id: ModuleId, deck: number, slot: number): Save {
  const r = placeModule(save.ship, save.wallet, id, deck, slot)
  return r ? { ...save, ship: r.ship, wallet: r.wallet } : save
}
export function upgradeOnShip(save: Save, id: ModuleId): Save {
  const r = upgradeModule(save.ship, save.wallet, id)
  return r ? { ...save, ship: r.ship, wallet: r.wallet } : save
}
export function researchOnShip(save: Save, project: string): Save {
  const r = startResearch(save.ship, save.wallet, project)
  return r ? { ...save, ship: r.ship, wallet: r.wallet } : save
}
/** The sortie's power choice, remembered on the ship for the next one; the same save when it's over the reactor. */
export function setPowered(save: Save, systems: readonly SystemId[]): Save {
  const chosen = powerChoice(save.ship, systems)
  return chosen ? { ...save, ship: { ...save.ship, powered: chosen } } : save
}
/** Toggling one system: on when it fits the reactor, off always. */
export function togglePower(save: Save, system: SystemId): Save {
  const on = save.ship.powered.includes(system)
  return setPowered(save, on ? save.ship.powered.filter((s) => s !== system) : [...save.ship.powered, system])
}
