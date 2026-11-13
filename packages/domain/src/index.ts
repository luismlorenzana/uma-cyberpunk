// uma-cyberpunk's rules: pure, no I/O. CY3 brings save v1; CY4 adds the battle package beside this one.
export const GAME = 'uma-cyberpunk' as const

export * from './save/save'
export * from './story/index'
export * from './ship/rooms'
export * from './worlds/map'
export * from './crew/parts'
export * from './crew/crew'
export * from './crew/stand-in'
export * from './crew/bonds'
export * from './captain'
