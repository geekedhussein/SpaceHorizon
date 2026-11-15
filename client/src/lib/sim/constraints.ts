// Pre-launch checks: does the design fit its launcher, its budget, its power
// and data needs? Pure functions. The numbers come from budgets.ts; this file
// only compares them and reports.

import { computeBudgets, resolveDesign } from './budgets.ts'
import type { Budgets, ResolvedDesign } from './budgets.ts'
import { ALLOWED_DEPTH_OF_DISCHARGE, DAYS_PER_YEAR, DIFFICULTY_SETTINGS } from './parameters.ts'
import type {
  CheckId,
  CheckStatus,
  ConstraintCheck,
  Design,
  Difficulty,
  Scenario,
  SimulationContext,
  TextValues,
} from './types.ts'

const percent = (fraction: number): number => fraction * 100

/**
 * Check a resolved design against every constraint. Returns one entry per
 * check that applies, in a fixed order, including the ones that pass.
 *
 * Checks that say "the mission cannot fly at all" are blockers. The rest are
 * risks: the mission may launch, and the simulation shows what goes wrong.
 * In sandbox mode only a missing or unknown part still blocks.
 */
export function checkConstraints(
  resolved: ResolvedDesign,
  budgets: Budgets,
  scenario: Scenario,
  options: { difficulty: Difficulty; sandbox?: boolean },
): ConstraintCheck[] {
  const settings = DIFFICULTY_SETTINGS[options.difficulty]
  const softBlock: CheckStatus = options.sandbox ? 'risk' : 'blocked'
  const checks: ConstraintCheck[] = []
  const add = (id: CheckId, problem: boolean, severity: CheckStatus, values: TextValues = {}) => {
    checks.push({ id, status: problem ? severity : 'ok', values })
  }

  const { orbit, launcher, structure } = resolved
  const missing = [
    ['orbit', orbit],
    ['launcher', launcher],
    ['structure', structure],
    ['computer', resolved.computer],
  ]
    .filter(([, value]) => value === null)
    .map(([slot]) => slot as string)
  add('design_incomplete', missing.length > 0, 'blocked', { missing: missing.join(',') })
  if (resolved.unknownIds.length > 0) {
    add('unknown_part', true, 'blocked', { ids: resolved.unknownIds.join(', ') })
  }

  // Launch segment.
  if (orbit && launcher) {
    const capacityKg = launcher.capacity_kg_by_orbit[orbit.id] ?? null
    add('orbit_not_served', capacityKg === null, 'blocked', {
      launcher: launcher.name,
      orbit: orbit.name,
    })
    if (capacityKg !== null) {
      const neededKg = budgets.massKg * (1 + settings.massMargin)
      add('launch_mass', neededKg > capacityKg, softBlock, {
        massKg: budgets.massKg,
        marginPercent: percent(settings.massMargin),
        neededKg,
        capacityKg,
        launcher: launcher.name,
      })
    }
  }

  // Space segment: does it all fit the structure?
  if (structure) {
    add('cubesat_mass', budgets.massKg > structure.max_mass_kg, softBlock, {
      massKg: budgets.massKg,
      limitKg: structure.max_mass_kg,
      structure: structure.name,
    })
    const misfits = [
      resolved.solarArray,
      resolved.battery,
      resolved.computer,
      resolved.attitudeControl,
      resolved.propulsion,
      ...resolved.radios,
      ...resolved.instruments,
    ].filter(
      (entry) =>
        entry?.fits_form_factors_u && !entry.fits_form_factors_u.includes(structure.form_factor_u),
    )
    add('part_fit', misfits.length > 0, softBlock, {
      parts: misfits.map((entry) => entry?.name).join(', '),
      structure: structure.name,
    })
    const usedU = resolved.instruments.reduce((sum, instrument) => sum + (instrument.volume_u ?? 0), 0)
    add('instrument_volume', usedU > structure.form_factor_u, softBlock, {
      usedU,
      sizeU: structure.form_factor_u,
    })
  }

  add('budget', budgets.cost.totalMusd > scenario.budget_musd, softBlock, {
    costMusd: budgets.cost.totalMusd,
    budgetMusd: scenario.budget_musd,
  })

  // Parts a working spacecraft needs. Flying without one is allowed, and the
  // simulation shows the result.
  add('solar_array', resolved.solarArray === null, 'risk')
  add('battery', resolved.battery === null, 'risk')
  add('radio', resolved.radios.length === 0, 'risk')
  add('pointing', resolved.attitudeControl === null, 'risk')
  add(
    'instrument',
    !resolved.instruments.some((entry) => entry.compatible_objectives.includes(scenario.objective_id)),
    'risk',
  )
  add('ground_station', resolved.bookings.length === 0, 'risk')

  const mission = budgets.mission
  if (!mission) return checks

  // Ground segment.
  if (resolved.radios.length > 0 && mission.links.length > 0) {
    const deaf = mission.links.filter((link) => link.radioId === null)
    add('station_link', deaf.length > 0, 'risk', {
      stations: deaf.map((link) => link.stationName).join('; '),
    })
    add('command_link', !mission.commandLink, 'risk')
  }
  const overbooked = mission.links.find(
    (link) => link.requestedPassesPerDay > link.availablePassesPerDay + 1e-9,
  )
  if (mission.links.length > 0) {
    add('station_passes', overbooked !== undefined, 'risk', {
      station: overbooked?.stationName ?? '',
      requested: overbooked?.requestedPassesPerDay ?? 0,
      available: overbooked?.availablePassesPerDay ?? 0,
    })
  }

  // Power.
  const { power, battery } = mission
  add('power', power.endOfLifeW < power.requiredW * (1 + settings.powerMargin), 'risk', {
    availableW: power.endOfLifeW,
    neededW: power.requiredW,
    marginPercent: percent(settings.powerMargin),
  })
  if (resolved.battery) {
    add('battery_depth', battery.essentialsDepth > ALLOWED_DEPTH_OF_DISCHARGE, 'risk', {
      depthPercent: percent(battery.essentialsDepth),
      allowedPercent: percent(ALLOWED_DEPTH_OF_DISCHARGE),
      eclipseMinutes: mission.orbit.eclipseS / 60,
    })
  }

  // Data.
  if (mission.dataGeneratedGbPerDay > 0) {
    add('data_downlink', mission.downlinkCapacityGbPerDay < mission.dataGeneratedGbPerDay, 'risk', {
      generatedGb: mission.dataGeneratedGbPerDay,
      capacityGb: mission.downlinkCapacityGbPerDay,
    })
  }

  // Lifetime.
  if (structure) {
    const reentryDay = mission.drag.reentryDay
    add('orbit_lifetime', reentryDay !== null, 'risk', {
      years: (reentryDay ?? budgets.plannedDays) / DAYS_PER_YEAR,
      plannedYears: scenario.planned_lifetime_years,
    })
  }

  return checks
}

/** Convenience for the UI: resolve, budget and check a design in one call. */
export function checkDesign(
  design: Design,
  scenario: Scenario,
  context: Pick<SimulationContext, 'catalog' | 'difficulty' | 'sandbox'>,
): { resolved: ResolvedDesign; budgets: Budgets; checks: ConstraintCheck[] } {
  const resolved = resolveDesign(design, context.catalog)
  const budgets = computeBudgets(resolved, scenario)
  return { resolved, budgets, checks: checkConstraints(resolved, budgets, scenario, context) }
}

export function isBlocked(checks: ConstraintCheck[]): boolean {
  return checks.some((check) => check.status === 'blocked')
}
