// Stars, badges and personal bests: the game layer on top of a flown mission.
// Pure: it reads a SimulationResult and never changes the physics or the score.
// Thresholds here are game-design values (docs/model-assumptions.md, section 7).

import type { Design, Scenario, SimulationResult } from '../sim/types.ts'

/** The three mission objectives. Each one met earns a star. */
export type StarId = 'orbit' | 'life' | 'requirements'

export type BadgeId =
  | 'first-orbit'
  | 'full-life'
  | 'all-requirements'
  | 'high-score'
  | 'thrifty'
  | 'overachiever'
  | 'nothing-lost'
  | 'trade-study'
  | 'point-design'
  | 'team-effort'
  | 'orbit-explorer'
  | 'veteran'

/** Every badge, in the order the shelf shows them. */
export const BADGES: readonly BadgeId[] = [
  'first-orbit',
  'full-life',
  'all-requirements',
  'high-score',
  'thrifty',
  'overachiever',
  'nothing-lost',
  'trade-study',
  'point-design',
  'team-effort',
  'orbit-explorer',
  'veteran',
]

/** Score that earns "Top marks". */
export const HIGH_SCORE = 90
/** "Thrifty": every requirement met for at most this share of the budget. */
export const THRIFTY_SHARE = 0.4
/** "Overachiever": a requirement beaten by this factor (double, or half for a limit). */
export const OVERACHIEVE_FACTOR = 2
/** "Veteran": missions flown that reached orbit. */
export const VETERAN_FLIGHTS = 10

/** What the browser remembers about one player's flights. */
export interface Profile {
  /** Missions flown that reached orbit (sandbox flights do not count). */
  flights: number
  /** Orbits flown to, by id. */
  orbits: string[]
  badges: BadgeId[]
  /** Best score per "scenario|difficulty". */
  bests: Record<string, number>
}

export const emptyProfile = (): Profile => ({ flights: 0, orbits: [], badges: [], bests: {} })

export interface Rewards {
  stars: { id: StarId; earned: boolean }[]
  /** Badges this flight qualifies for, earned before or not. */
  earned: BadgeId[]
  /** Badges earned for the first time on this flight. */
  newBadges: BadgeId[]
  /** The best score before this flight, or null if this is the first. */
  previousBest: number | null
  newBest: boolean
  /** Sandbox flights earn stars but no badges and no bests. */
  counted: boolean
}

export interface RewardContext {
  scenario: Scenario
  design: Design
  /** Every orbit a player could fly to, for "Orbit explorer". */
  orbitIds: readonly string[]
  /** Flown in a room with more than one player. */
  team: boolean
}

export const bestKey = (scenarioId: string, difficulty: string) => `${scenarioId}|${difficulty}`

export function starsFor(result: SimulationResult): Rewards['stars'] {
  return [
    { id: 'orbit', earned: result.outcome.endDay > 0 },
    { id: 'life', earned: result.outcome.status === 'completed' },
    { id: 'requirements', earned: result.requirements.length > 0 && result.requirements.every((entry) => entry.met) },
  ]
}

/** True if a met requirement was beaten by OVERACHIEVE_FACTOR or more. */
function overachieved(result: SimulationResult): boolean {
  return result.requirements.some((entry) => {
    if (!entry.met || entry.value === null || entry.threshold <= 0) return false
    return entry.comparator === '>='
      ? entry.value >= entry.threshold * OVERACHIEVE_FACTOR
      : entry.value <= entry.threshold / OVERACHIEVE_FACTOR
  })
}

/** Score a flight for the game layer and return the profile it leaves behind. */
export function award(
  result: SimulationResult,
  context: RewardContext,
  profile: Profile,
): { rewards: Rewards; profile: Profile } {
  const stars = starsFor(result)
  const [reachedOrbit, lasted, allMet] = stars.map((star) => star.earned)
  const counted = !result.sandbox
  const key = bestKey(result.scenarioId, result.difficulty)
  const previousBest = profile.bests[key] ?? null

  if (!counted) {
    return {
      rewards: { stars, earned: [], newBadges: [], previousBest, newBest: false, counted },
      profile,
    }
  }

  const flights = profile.flights + (reachedOrbit ? 1 : 0)
  const orbits =
    reachedOrbit && context.design.orbitId && !profile.orbits.includes(context.design.orbitId)
      ? [...profile.orbits, context.design.orbitId]
      : profile.orbits
  const collaboration = result.score.parts.find((part) => part.id === 'collaboration')
  const success = lasted && allMet

  const qualifies: Record<BadgeId, boolean> = {
    'first-orbit': reachedOrbit,
    'full-life': lasted,
    'all-requirements': allMet,
    'high-score': result.score.total >= HIGH_SCORE,
    thrifty: allMet && result.totals.costMusd <= context.scenario.budget_musd * THRIFTY_SHARE,
    overachiever: overachieved(result),
    'nothing-lost': lasted && result.totals.dataDownlinkedGb > 0 && result.totals.dataLostGb === 0,
    'trade-study': success && result.difficulty === 'trade-study',
    'point-design': success && result.difficulty === 'point-design',
    'team-effort': context.team && collaboration !== undefined && collaboration.weight > 0 && collaboration.fraction >= 1,
    'orbit-explorer': context.orbitIds.length > 0 && context.orbitIds.every((id) => orbits.includes(id)),
    veteran: flights >= VETERAN_FLIGHTS,
  }
  const earned = BADGES.filter((id) => qualifies[id])
  const newBadges = earned.filter((id) => !profile.badges.includes(id))
  const newBest = reachedOrbit && (previousBest === null || result.score.total > previousBest)

  return {
    rewards: { stars, earned, newBadges, previousBest, newBest, counted },
    profile: {
      flights,
      orbits,
      badges: [...profile.badges, ...newBadges],
      bests: newBest ? { ...profile.bests, [key]: result.score.total } : profile.bests,
    },
  }
}

/** Read a stored profile, keeping only fields of the right shape. */
export function parseProfile(text: string | null): Profile {
  const profile = emptyProfile()
  if (!text) return profile
  try {
    const raw = JSON.parse(text) as Partial<Profile>
    if (Number.isInteger(raw.flights) && (raw.flights as number) >= 0) profile.flights = raw.flights as number
    if (Array.isArray(raw.orbits)) profile.orbits = raw.orbits.filter((id) => typeof id === 'string')
    if (Array.isArray(raw.badges)) profile.badges = raw.badges.filter((id): id is BadgeId => BADGES.includes(id))
    if (raw.bests && typeof raw.bests === 'object') {
      for (const [key, value] of Object.entries(raw.bests)) {
        if (typeof value === 'number' && Number.isFinite(value)) profile.bests[key] = value
      }
    }
  } catch {
    // A damaged entry starts a fresh profile.
  }
  return profile
}
