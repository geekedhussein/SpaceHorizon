// The six resource bars: what is used against what is allowed. Pure: it only
// reads the budgets worked out in /lib/sim and compares them.

import type { Budgets, ResolvedDesign } from '../sim/budgets.ts'
import { DAYS_PER_YEAR, DIFFICULTY_SETTINGS } from '../sim/parameters.ts'
import type { Difficulty, Scenario } from '../sim/types.ts'

export type ResourceId = 'mass' | 'power' | 'budget' | 'data' | 'comms' | 'time'

/** ok: fine. tight: within 10% of the limit. over: past it. none: nothing to compare yet. */
export type BarStatus = 'ok' | 'tight' | 'over' | 'none'

export interface ResourceBar {
  id: ResourceId
  used: number | null
  limit: number | null
  /** Share of the bar to fill, 0 to 1. */
  fraction: number
  status: BarStatus
  /** True for the one bar where more is better (time in orbit). */
  moreIsBetter: boolean
}

/** Within this share of the limit a bar reads "tight". Display only. */
const TIGHT_SHARE = 0.9

function bar(id: ResourceId, used: number | null, limit: number | null, problem = false): ResourceBar {
  if (used === null || limit === null || limit <= 0) {
    return { id, used, limit, fraction: 0, status: problem ? 'over' : 'none', moreIsBetter: false }
  }
  const share = used / limit
  const status: BarStatus = share > 1 + 1e-9 || problem ? 'over' : share > TIGHT_SHARE ? 'tight' : 'ok'
  return { id, used, limit, fraction: Math.min(1, Math.max(0, share)), status, moreIsBetter: false }
}

export function resourceBars(
  resolved: ResolvedDesign,
  budgets: Budgets,
  scenario: Scenario,
  difficulty: Difficulty,
): ResourceBar[] {
  const settings = DIFFICULTY_SETTINGS[difficulty]
  const mission = budgets.mission

  // Mass: the launcher's capacity (less the level's margin) or the structure's
  // own limit, whichever is lower.
  const capacityKg =
    resolved.launcher && resolved.orbit ? (resolved.launcher.capacity_kg_by_orbit[resolved.orbit.id] ?? null) : null
  const massLimits = [
    capacityKg === null ? null : capacityKg / (1 + settings.massMargin),
    resolved.structure?.max_mass_kg ?? null,
  ].filter((limit): limit is number => limit !== null)
  const mass = bar('mass', budgets.massKg, massLimits.length > 0 ? Math.min(...massLimits) : null)

  const power = mission
    ? bar('power', mission.power.requiredW * (1 + settings.powerMargin), mission.power.endOfLifeW)
    : bar('power', null, null)
  // Loads with no array at all: nothing to compare against, but it is a problem.
  if (mission && mission.power.endOfLifeW <= 0 && mission.power.requiredW > 0) power.status = 'over'

  const budget = bar('budget', budgets.cost.totalMusd, scenario.budget_musd)

  const data = mission
    ? bar('data', mission.dataGeneratedGbPerDay, mission.downlinkCapacityGbPerDay)
    : bar('data', null, null)
  if (mission && mission.dataGeneratedGbPerDay > 0 && mission.downlinkCapacityGbPerDay <= 0) data.status = 'over'

  let comms = bar('comms', null, null)
  if (mission && mission.links.length > 0) {
    const requested = mission.links.reduce((sum, link) => sum + link.requestedPassesPerDay, 0)
    const available = mission.links.reduce((sum, link) => sum + link.availablePassesPerDay, 0)
    const unheard = mission.links.some((link) => link.radioId === null)
    const overbooked = mission.links.some((link) => link.requestedPassesPerDay > link.availablePassesPerDay + 1e-9)
    comms = bar('comms', requested, available, unheard || overbooked)
  }

  // Time: years the orbit lasts against the plan. More is better.
  let time: ResourceBar = { id: 'time', used: null, limit: null, fraction: 0, status: 'none', moreIsBetter: true }
  if (mission && resolved.structure) {
    const plannedYears = scenario.planned_lifetime_years
    const reentryDay = mission.drag.reentryDay
    const years = reentryDay === null ? plannedYears : reentryDay / DAYS_PER_YEAR
    time = {
      id: 'time',
      used: years,
      limit: plannedYears,
      fraction: Math.min(1, years / plannedYears),
      status: reentryDay === null ? 'ok' : 'over',
      moreIsBetter: true,
    }
  }

  return [mass, power, budget, data, comms, time]
}
