// The six steps of the game, in order (CLAUDE.md section 3).

export const PHASES = ['need', 'concept', 'requirements', 'design', 'verify', 'operate'] as const
export type Phase = (typeof PHASES)[number]
