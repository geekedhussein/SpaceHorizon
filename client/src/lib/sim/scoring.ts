// Scoring: turn a finished mission into requirement results and a score with
// its breakdown. Pure functions. The weights are game-design values from
// parameters.ts.

import { SCORE_WEIGHTS, SENSIBLE_MARGIN } from './parameters.ts'
import type { Requirement, RequirementResult, ScoreBreakdown, ScorePart } from './types.ts'

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/**
 * Judge one requirement. `value` is null when the mission never achieved the
 * quantity at all (for example no pictures, so no resolution).
 */
export function evaluateRequirement(requirement: Requirement, value: number | null): RequirementResult {
  const { id, metric, comparator, threshold, unit } = requirement
  let met = false
  let achievement = 0
  if (value !== null) {
    met = comparator === '<=' ? value <= threshold : value >= threshold
    if (met) achievement = 1
    // How close a miss came: the ratio of the goal to the result, or the reverse.
    else if (comparator === '<=') achievement = value > 0 ? clamp01(threshold / value) : 0
    else achievement = threshold > 0 ? clamp01(value / threshold) : 0
  }
  return { id, metric, comparator, threshold, unit, value, met, achievement }
}

/**
 * Marks for one margin (spare share of a resource). A shortfall earns nothing.
 * Spare up to the "full" level earns full marks. More than that is waste, and
 * the marks fall in a straight line to zero.
 */
export function marginScore(margin: number | null): number {
  if (margin === null || margin < 0) return 0
  if (margin <= SENSIBLE_MARGIN.full) return 1
  return clamp01((SENSIBLE_MARGIN.zero - margin) / (SENSIBLE_MARGIN.zero - SENSIBLE_MARGIN.full))
}

export interface ScoreInputs {
  requirements: RequirementResult[]
  operatedDays: number
  plannedDays: number
  costMusd: number
  budgetMusd: number
  /** Spare shares of power and downlink; null where there is nothing to measure. */
  margins: (number | null)[]
  /** Team mode only, 0 to 1. Leave undefined for a solo game. */
  collaboration?: number
}

/**
 * Score out of 100, as a weighted sum:
 * - requirements: the average of how well each requirement was met;
 * - survival: the share of the planned lifetime the spacecraft worked;
 * - efficiency: half unused budget, half sensible margins, scaled by the
 *   requirements part so that a cheap mission that achieves nothing earns
 *   nothing for being cheap;
 * - collaboration (team mode): supplied by the multiplayer layer.
 */
export function scoreMission(inputs: ScoreInputs): ScoreBreakdown {
  const team = inputs.collaboration !== undefined
  const weights = team ? SCORE_WEIGHTS.team : SCORE_WEIGHTS.solo

  const requirements =
    inputs.requirements.length > 0
      ? inputs.requirements.reduce((sum, result) => sum + result.achievement, 0) /
        inputs.requirements.length
      : 0
  const survival = inputs.plannedDays > 0 ? clamp01(inputs.operatedDays / inputs.plannedDays) : 0
  const unusedBudget = inputs.budgetMusd > 0 ? clamp01(1 - inputs.costMusd / inputs.budgetMusd) : 0
  const margins =
    inputs.margins.length > 0
      ? inputs.margins.reduce((sum: number, margin) => sum + marginScore(margin), 0) /
        inputs.margins.length
      : 0
  const efficiency = (0.5 * unusedBudget + 0.5 * margins) * requirements

  const part = (id: ScorePart['id'], weight: number, fraction: number): ScorePart => ({
    id,
    weight,
    fraction,
    points: Math.round(weight * fraction * 10) / 10,
  })
  const parts = [
    part('requirements', weights.requirements, requirements),
    part('survival', weights.survival, survival),
    part('efficiency', weights.efficiency, efficiency),
  ]
  if (team) parts.push(part('collaboration', weights.collaboration, clamp01(inputs.collaboration ?? 0)))

  const total = Math.round(parts.reduce((sum, entry) => sum + entry.points, 0) * 10) / 10
  return { total, parts }
}

/** The score of a mission that never left the ground. */
export function zeroScore(team: boolean): ScoreBreakdown {
  const weights = team ? SCORE_WEIGHTS.team : SCORE_WEIGHTS.solo
  const ids: ScorePart['id'][] = ['requirements', 'survival', 'efficiency']
  if (team) ids.push('collaboration')
  return {
    total: 0,
    parts: ids.map((id) => ({ id, weight: weights[id], fraction: 0, points: 0 })),
  }
}
