// The mission simulation: a pure, deterministic function.
//
//   simulate(design, scenario, seed, context) -> SimulationResult
//
// Same inputs and seed give the same result on every machine. No
// Math.random(), no clock, no network, no DOM. All randomness comes from a
// seeded generator.
//
// The mission is stepped one day at a time using orbit-averaged quantities,
// so a multi-year mission is a few hundred cheap steps. Each day: random
// events, solar power, loads (switching off what cannot be powered), data made
// and sent, then drag and the thruster.

import { SOLAR_DAY_S } from '../physics/constants.ts'
import { J_PER_WH, M_PER_KM } from '../physics/units.ts'
import {
  computeBudgets,
  downlinkCapacityGbPerDay,
  dragDay,
  requiredSunlitPowerW,
  resolveDesign,
  sunlitArrayPowerW,
  thrusterDemand,
  transmitLoadW,
  transmitTimeShare,
} from './budgets.ts'
import type { Budgets, MissionBudgets, PowerLoads, ResolvedDesign } from './budgets.ts'
import { checkConstraints, isBlocked } from './constraints.ts'
import {
  ALLOWED_DEPTH_OF_DISCHARGE,
  BITS_PER_GB,
  DAYS_PER_YEAR,
  DIFFICULTY_SETTINGS,
  EARTH_LAND_AREA_M2,
} from './parameters.ts'
import { mulberry32 } from './prng.ts'
import { evaluateRequirement, scoreMission, zeroScore } from './scoring.ts'
import type {
  Cause,
  Design,
  EventOccurrence,
  MissionEvent,
  MissionStatus,
  MissionTotals,
  RequirementResult,
  Scenario,
  SimulationContext,
  SimulationResult,
  StepLog,
} from './types.ts'

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/** How far between `low` and `high` the available amount reaches, 0 to 1. */
function share(available: number, low: number, high: number): number {
  return high > low ? clamp01((available - low) / (high - low)) : 0
}

/** Chance of an event on one day, from its chance of happening in a year. */
export function dailyProbability(probabilityPerYear: number, factor: number): number {
  const perDay = 1 - (1 - clamp01(probabilityPerYear)) ** (1 / DAYS_PER_YEAR)
  return clamp01(perDay * factor)
}

/** What the day-by-day run found, for the totals and the explanations. */
interface Flight {
  status: MissionStatus
  steps: StepLog[]
  events: EventOccurrence[]
  dataGeneratedGb: number
  dataDownlinkedGb: number
  dataLostGb: number
  dataStoredGb: number
  propellantKg: number
  altitudeM: number
  /** Days on which the array could not power all the planned work. */
  shortDays: number
  thrusterOffDay: number | null
  propellantEmptyDay: number | null
  /** Sunlit power available and needed on the day the power failed. */
  powerFailure: { availableW: number; neededW: number } | null
}

function fly(
  resolved: ResolvedDesign,
  budgets: Budgets,
  mission: MissionBudgets,
  events: MissionEvent[],
  eventFactor: number,
  random: () => number,
): Flight {
  const { orbit, battery, imaging, drag } = mission
  const base = mission.power.loads
  const timeShare = transmitTimeShare(base, orbit)
  const sunlitShare = 1 - orbit.eclipseFraction
  const startPropellantKg = resolved.propulsion?.propellant_kg ?? 0

  const flight: Flight = {
    status: 'completed',
    steps: [],
    events: [],
    dataGeneratedGb: 0,
    dataDownlinkedGb: 0,
    dataLostGb: 0,
    dataStoredGb: 0,
    propellantKg: startPropellantKg,
    altitudeM: orbit.altitudeM,
    shortDays: 0,
    thrusterOffDay: null,
    propellantEmptyDay: null,
    powerFailure: null,
  }

  // The battery must carry the always-on parts through every eclipse.
  if (battery.essentialsDepth > 1) {
    flight.status = 'power_lost'
    return flight
  }

  let arrayHealth = 1
  let safeModeUntilDay = 0
  const outageUntilDay = new Map<string, number>()

  for (let day = 1; day <= budgets.plannedDays; day++) {
    // 1. Random events. Two draws per event per day, used or not, so the
    //    random sequence never depends on the design.
    const today: string[] = []
    if (eventFactor > 0) {
      for (const event of events) {
        const roll = random()
        const pick = random()
        if (roll >= dailyProbability(event.probability_per_year, eventFactor)) continue
        const occurrence: EventOccurrence = { day, eventId: event.id }
        const effect = event.effect
        if (effect.kind === 'station_outage') {
          if (mission.links.length === 0) continue
          const link = mission.links[Math.floor(pick * mission.links.length)]
          outageUntilDay.set(link.stationId, day + effect.duration_days - 1)
          occurrence.stationId = link.stationId
        } else if (effect.kind === 'safe_mode') {
          safeModeUntilDay = Math.max(safeModeUntilDay, day + effect.duration_days - 1)
        } else {
          arrayHealth *= 1 - clamp01(effect.power_loss_fraction)
        }
        today.push(event.id)
        flight.events.push(occurrence)
      }
    }
    const safeMode = day <= safeModeUntilDay
    const links = mission.links.filter((link) => (outageUntilDay.get(link.stationId) ?? 0) < day)

    // 2. Power. Switch loads off in order until the array can carry the rest:
    //    imaging first, then sending data, then the thruster.
    const thruster = thrusterDemand({
      altitudeM: flight.altitudeM,
      effectiveAreaM2: drag.effectiveAreaM2,
      propulsion: drag.thrusterUsable ? resolved.propulsion : null,
      propellantKg: flight.propellantKg,
      eclipseFraction: orbit.eclipseFraction,
    })
    const loads: PowerLoads = {
      essentialsW: base.essentialsW,
      imagingDaylightW: safeMode ? 0 : base.imagingDaylightW,
      transmitW: safeMode ? 0 : transmitLoadW(links),
      transmitInEclipse: base.transmitInEclipse,
      thrusterDaylightW: thruster.daylightW,
    }
    const sunlitPowerW = sunlitArrayPowerW(resolved, (day - 1) / DAYS_PER_YEAR, arrayHealth)
    const needW = (imagingOn: number, transmitOn: number, thrusterOn: number): number =>
      requiredSunlitPowerW(loads, orbit, {
        imaging: imagingOn,
        transmit: transmitOn,
        thruster: thrusterOn,
      })

    if (sunlitPowerW < needW(0, 0, 0)) {
      flight.status = 'power_lost'
      flight.powerFailure = { availableW: sunlitPowerW, neededW: needW(0, 0, 0) }
      break
    }
    let imagingOn = 1
    let transmitOn = 1
    let thrusterOn = 1
    if (needW(1, 1, 1) > sunlitPowerW) {
      imagingOn = share(sunlitPowerW, needW(0, 1, 1), needW(1, 1, 1))
      if (imagingOn === 0 && needW(0, 1, 1) > sunlitPowerW) {
        transmitOn = share(sunlitPowerW, needW(0, 0, 1), needW(0, 1, 1))
        if (transmitOn === 0 && needW(0, 0, 1) > sunlitPowerW) thrusterOn = 0
      }
    }
    const short =
      (imagingOn < 1 && loads.imagingDaylightW > 0) || (transmitOn < 1 && loads.transmitW > 0)
    if (short) flight.shortDays++
    if (thrusterOn === 0 && thruster.daylightW > 0) flight.thrusterOffDay ??= day

    // 3. Data: take pictures, send what fits, store the rest, lose the overflow.
    const imagingActivity = safeMode || imaging.plannedSPerDay === 0 ? 0 : imagingOn
    const capacityGb = safeMode ? 0 : downlinkCapacityGbPerDay(links, timeShare) * transmitOn
    const generatedGb = (imaging.dataRateBps * imaging.plannedSPerDay * imagingActivity) / BITS_PER_GB
    const waitingGb = flight.dataStoredGb + generatedGb
    const downlinkedGb = Math.min(waitingGb, capacityGb)
    const storedGb = Math.min(waitingGb - downlinkedGb, budgets.storageGb)
    const lostGb = waitingGb - downlinkedGb - storedGb
    flight.dataGeneratedGb += generatedGb
    flight.dataDownlinkedGb += downlinkedGb
    flight.dataLostGb += lostGb
    flight.dataStoredGb = storedGb

    // 4. Drag and the thruster.
    const next = dragDay({
      altitudeM: flight.altitudeM,
      massKg: budgets.massKg,
      effectiveAreaM2: drag.effectiveAreaM2,
      propulsion: resolved.propulsion,
      propellantKg: flight.propellantKg,
      eclipseFraction: orbit.eclipseFraction,
      thrusterRuns: drag.thrusterUsable && thrusterOn === 1,
    })
    if (flight.propellantKg > 0 && next.propellantKg <= 1e-12) flight.propellantEmptyDay ??= day
    flight.propellantKg = Math.max(0, next.propellantKg)
    flight.altitudeM = next.altitudeM

    const transmitting = capacityGb > 0
    flight.steps.push({
      day,
      altitudeKm: flight.altitudeM / M_PER_KM,
      sunlitPowerW,
      generationW: sunlitPowerW * sunlitShare,
      consumptionW:
        loads.essentialsW +
        (loads.imagingDaylightW * imagingOn + next.thrusterDaylightW) * sunlitShare +
        loads.transmitW * transmitOn * timeShare,
      depthOfDischarge:
        battery.capacityWh > 0
          ? battery.essentialsDepth +
            (base.transmitInEclipse && transmitting
              ? (battery.transmitDepth - battery.essentialsDepth) * transmitOn
              : 0)
          : null,
      imagingActivity,
      downlinkActivity: transmitting ? transmitOn : 0,
      dataGeneratedGb: generatedGb,
      dataDownlinkedGb: downlinkedGb,
      dataStoredGb: storedGb,
      dataLostGb: lostGb,
      propellantKg: flight.propellantKg,
      arrayHealth,
      events: today,
    })

    if (next.reentered) {
      flight.status = 'reentered'
      break
    }
  }
  return flight
}

/** Measure each requirement from what the mission returned. */
function measureRequirements(
  scenario: Scenario,
  mission: MissionBudgets | null,
  flight: Flight | null,
): RequirementResult[] {
  const operatedDays = flight?.steps.length ?? 0
  const scienceGb = flight && mission ? flight.dataDownlinkedGb * mission.imaging.scienceShare : 0
  const gotPictures = scienceGb > 0 && operatedDays > 0

  return scenario.requirements.map((requirement) => {
    let value: number | null = null
    if (mission && flight) {
      const { imaging, orbit } = mission
      switch (requirement.metric) {
        case 'ground_resolution_m':
          value = gotPictures ? imaging.groundResolutionM : null
          break
        case 'revisit_days':
          // Two limits: the strips must close up at the equator, and enough
          // pictures must reach the ground to cover all land.
          if (gotPictures && imaging.swathM !== null && imaging.equatorialRevisitDays !== null) {
            const returnedSPerDay =
              (flight.dataDownlinkedGb * BITS_PER_GB) / imaging.dataRateBps / operatedDays
            const landDays = EARTH_LAND_AREA_M2 / (imaging.swathM * orbit.groundSpeedMS * returnedSPerDay)
            value = Math.max(imaging.equatorialRevisitDays, landDays)
          }
          break
        case 'data_returned_gb_per_month':
          value = operatedDays > 0 ? (scienceGb / operatedDays) * (DAYS_PER_YEAR / 12) : null
          break
        case 'lifetime_years':
          value = Math.min(operatedDays / DAYS_PER_YEAR, scenario.planned_lifetime_years)
          break
      }
    }
    return evaluateRequirement(requirement, value)
  })
}

/** Plain-language reasons for the outcome. The words live in /lib/strings. */
function explain(
  resolved: ResolvedDesign,
  mission: MissionBudgets,
  flight: Flight,
  requirements: RequirementResult[],
  events: MissionEvent[],
): Cause[] {
  const causes: Cause[] = []
  const { orbit, imaging, battery } = mission
  const operatedDays = flight.steps.length
  const hasInstrument = resolved.instruments.length > 0
  const canDownlink = mission.links.some((link) => link.rateBps > 0 && link.contactSPerDay > 0)

  if (flight.status === 'reentered') {
    causes.push({
      id: 'reentered',
      severity: 'failure',
      values: { day: operatedDays, years: operatedDays / DAYS_PER_YEAR, altitudeKm: orbit.altitudeM / M_PER_KM },
    })
  }
  if (flight.status === 'power_lost') {
    if (flight.powerFailure) {
      causes.push({
        id: 'power_lost_array',
        severity: 'failure',
        values: { day: operatedDays + 1, ...flight.powerFailure },
      })
    } else {
      causes.push({
        id: 'power_lost_battery',
        severity: 'failure',
        values: {
          eclipseMinutes: orbit.eclipseS / 60,
          neededWh: (mission.power.loads.essentialsW * orbit.eclipseS) / J_PER_WH,
          capacityWh: battery.capacityWh,
        },
      })
    }
  }

  // Parts of the design that kept the mission from doing science at all.
  if (!hasInstrument) {
    causes.push({ id: 'no_instrument', severity: 'failure', values: {} })
  } else if (!imaging.primary) {
    causes.push({
      id: 'instrument_unsuitable',
      severity: 'failure',
      values: { instrument: resolved.instruments[0].name },
    })
  }
  if (hasInstrument && !resolved.attitudeControl) {
    causes.push({ id: 'no_pointing', severity: 'failure', values: {} })
  } else if (hasInstrument && !mission.commandLink) {
    causes.push({ id: 'no_command_link', severity: 'failure', values: {} })
  }
  if (!canDownlink) causes.push({ id: 'no_downlink', severity: 'failure', values: {} })
  if (resolved.propulsion && !resolved.attitudeControl) {
    causes.push({ id: 'thruster_unpointed', severity: 'warning', values: {} })
  }

  // Things that went wrong along the way.
  if (flight.shortDays > 0 && operatedDays > 0) {
    const mean = (pick: (step: StepLog) => number): number =>
      flight.steps.reduce((sum, step) => sum + pick(step), 0) / operatedDays
    causes.push({
      id: 'power_shortage',
      severity: 'warning',
      values: {
        days: flight.shortDays,
        imagingPercent: 100 * mean((step) => step.imagingActivity),
        downlinkPercent: 100 * mean((step) => step.downlinkActivity),
      },
    })
  }
  if (flight.thrusterOffDay !== null) {
    causes.push({ id: 'thruster_off', severity: 'warning', values: { day: flight.thrusterOffDay } })
  }
  if (flight.propellantEmptyDay !== null) {
    causes.push({
      id: 'propellant_empty',
      severity: 'warning',
      values: { day: flight.propellantEmptyDay },
    })
  }
  if (canDownlink && battery.capacityWh > 0 && !battery.transmitInEclipse) {
    causes.push({
      id: 'eclipse_transmit_blocked',
      severity: 'warning',
      values: {
        depthPercent: 100 * battery.transmitDepth,
        allowedPercent: 100 * ALLOWED_DEPTH_OF_DISCHARGE,
      },
    })
  }
  if (flight.dataLostGb > 0) {
    causes.push({
      id: 'data_lost',
      severity: 'warning',
      values: { lostGb: flight.dataLostGb, percent: (100 * flight.dataLostGb) / flight.dataGeneratedGb },
    })
  }

  // Requirements missed, each with its own reason.
  for (const result of requirements) {
    if (result.met || result.value === null || !imaging.primary) continue
    if (result.metric === 'ground_resolution_m') {
      causes.push({
        id: 'resolution_missed',
        severity: 'failure',
        values: {
          instrument: imaging.primary.name,
          value: result.value,
          threshold: result.threshold,
          altitudeKm: orbit.altitudeM / M_PER_KM,
        },
      })
    } else if (result.metric === 'revisit_days' && imaging.swathM !== null) {
      if ((imaging.equatorialRevisitDays ?? 0) > result.threshold) {
        causes.push({
          id: 'revisit_swath',
          severity: 'failure',
          values: {
            instrument: imaging.primary.name,
            swathKm: imaging.swathM / M_PER_KM,
            days: imaging.equatorialRevisitDays ?? result.value,
            threshold: result.threshold,
          },
        })
      } else {
        const neededSPerDay =
          EARTH_LAND_AREA_M2 / (imaging.swathM * orbit.groundSpeedMS * result.threshold)
        causes.push({
          id: 'revisit_data',
          severity: 'failure',
          values: {
            days: result.value,
            threshold: result.threshold,
            neededMinutes: neededSPerDay / 60,
            returnedMinutes: (neededSPerDay / 60) * (result.threshold / result.value),
          },
        })
      }
    } else if (result.metric === 'data_returned_gb_per_month' && flight.dataGeneratedGb > 0) {
      // Pictures taken but never sent point at the downlink; otherwise too
      // few pictures were taken.
      const unsentGb = flight.dataLostGb + flight.dataStoredGb
      causes.push({
        id: unsentGb > 0.01 * flight.dataGeneratedGb ? 'data_downlink_limited' : 'data_imaging_limited',
        severity: 'failure',
        values: { value: result.value, threshold: result.threshold },
      })
    }
  }

  // Random events, one line per kind.
  for (const event of events) {
    const hits = flight.events.filter((occurrence) => occurrence.eventId === event.id)
    if (hits.length === 0) continue
    causes.push({
      id: 'event',
      severity: 'info',
      values: { name: event.name, day: hits[0].day, count: hits.length },
    })
  }

  if (requirements.length > 0 && requirements.every((result) => result.met)) {
    causes.push({ id: 'all_requirements_met', severity: 'info', values: {} })
  }
  return causes
}

/**
 * Simulate a whole mission.
 *
 * A design with a blocking problem (see constraints.ts) does not launch: the
 * result has no steps and a score of zero, and `checks` says what to fix.
 */
export function simulate(
  design: Design,
  scenario: Scenario,
  seed: number,
  context: SimulationContext,
): SimulationResult {
  const settings = DIFFICULTY_SETTINGS[context.difficulty]
  const sandbox = context.sandbox ?? false
  const team = context.collaboration !== undefined
  const events = context.events ?? []

  const resolved = resolveDesign(design, context.catalog)
  const budgets = computeBudgets(resolved, scenario)
  const checks = checkConstraints(resolved, budgets, scenario, {
    difficulty: context.difficulty,
    sandbox,
  })
  const { mission } = budgets
  const startAltitudeKm = mission ? mission.orbit.altitudeM / M_PER_KM : 0

  const result = (
    status: MissionStatus,
    flight: Flight | null,
    causes: Cause[],
  ): SimulationResult => {
    const operatedDays = flight?.steps.length ?? 0
    const requirements = measureRequirements(scenario, mission, flight)
    const totals: MissionTotals = {
      operatedDays,
      dataGeneratedGb: flight?.dataGeneratedGb ?? 0,
      dataDownlinkedGb: flight?.dataDownlinkedGb ?? 0,
      scienceDataGb: (flight?.dataDownlinkedGb ?? 0) * (mission?.imaging.scienceShare ?? 0),
      dataLostGb: flight?.dataLostGb ?? 0,
      dataStrandedGb: flight?.dataStoredGb ?? 0,
      propellantUsedKg: flight ? (resolved.propulsion?.propellant_kg ?? 0) - flight.propellantKg : 0,
      finalAltitudeKm: flight ? flight.altitudeM / M_PER_KM : startAltitudeKm,
      costMusd: budgets.cost.totalMusd,
      massKg: budgets.massKg,
    }
    const score =
      status === 'not_launched'
        ? zeroScore(team)
        : scoreMission({
            requirements,
            operatedDays,
            plannedDays: budgets.plannedDays,
            costMusd: budgets.cost.totalMusd,
            budgetMusd: scenario.budget_musd,
            margins: mission ? [mission.power.margin, mission.downlinkMargin] : [],
            collaboration: context.collaboration,
          })
    return {
      seed,
      scenarioId: scenario.id,
      difficulty: context.difficulty,
      sandbox,
      plannedDays: budgets.plannedDays,
      outcome: { status, endDay: operatedDays },
      steps: flight?.steps ?? [],
      events: flight?.events ?? [],
      totals,
      requirements,
      checks,
      score,
      causes:
        mission && flight
          ? [...causes, ...explain(resolved, mission, flight, requirements, events)]
          : causes,
    }
  }

  if (isBlocked(checks) || !mission || !resolved.launcher) {
    return result('not_launched', null, [{ id: 'not_launched', severity: 'failure', values: {} }])
  }

  // Launch. The draw is always made, so the event sequence that follows is
  // the same whether or not launch failures are switched on.
  const random = mulberry32(seed)
  const { launch_successes, launch_attempts, name } = resolved.launcher
  const launchDraw = random()
  if (settings.eventFactor > 0 && launchDraw >= launch_successes / launch_attempts) {
    return result('launch_failed', null, [
      {
        id: 'launch_failed',
        severity: 'failure',
        values: { launcher: name, successes: launch_successes, attempts: launch_attempts },
      },
    ])
  }

  const flight = fly(resolved, budgets, mission, events, settings.eventFactor, random)
  return result(flight.status, flight, [])
}

/** Seconds in one simulation step. Exported for the playback view. */
export const STEP_S = SOLAR_DAY_S
