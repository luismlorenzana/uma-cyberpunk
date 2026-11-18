// The rules version (CY4). A battle replays on the version it started with: a later version keeps the old branches, as
// uma-rpg's engine does, so a saved battle still replays the same way.
//
// - **1** (CY4): the core rules.
// - **2** (CY5): terrain and props, terminals, Tech and the Holds, the Back units' actions, chance skills, items, Stride,
//   the bench support call, three more objectives and the Steel Muster, plus an impact hit on the Core that can Stun,
//   cover tiles' bonus and grating's current. A version-1 battle plays exactly as CY4's did.
// - **3** (CY17): life aboard in battle: the bond perks and Resonance, the captain's Orders and the ship's support, the
//   powered systems' passives, the meals, partners and their duo technique. A version-2 battle plays exactly as before.
// - **4** (CY35): close-range Back units and marked splash weapons. Older inputs keep their original rules.
export const RULES_VERSION = 4
export const SUPPORTED_VERSIONS: readonly number[] = [1, 2, 3, 4]
