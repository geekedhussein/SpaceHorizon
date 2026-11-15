// The simulation's public surface. Pure TypeScript: no Svelte, no DOM.

export * from './types.ts'
export { mulberry32 } from './prng.ts'
export { checkConstraints, checkDesign, isBlocked } from './constraints.ts'
export { computeBudgets, resolveDesign } from './budgets.ts'
export type { Budgets, MissionBudgets, ResolvedDesign } from './budgets.ts'
export { scoreMission } from './scoring.ts'
export { simulate, STEP_S } from './simulate.ts'
