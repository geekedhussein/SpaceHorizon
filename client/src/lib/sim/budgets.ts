// Resource budgets for a design: mass, cost, power, battery, data, links and
// drag. Pure functions built on /lib/physics. The pre-launch checks, the
// simulation and (later) the live resource bars all read the same numbers
// from here, so they can never disagree.
//
// Every modelling shortcut in this file is listed in docs/model-assumptions.md.

import { EARTH_EQUATORIAL_RADIUS_M, SOLAR_DAY_S, STANDARD_GRAVITY_M_S2 } from '../physics/constants.ts'
import {
  equatorialRevisitTimeS,
  groundSampleDistanceM,
  maxPassDurationS,
  stationContactFraction,
  swathWidthM,
} from '../physics/coverage.ts'
import { atmosphericDensityKgM3, dragForceN, orbitDecay } from '../physics/drag.ts'
import {
  achievableDataRateBps,
  carrierToNoiseDensityDbHz,
  eirpDbw,
  freeSpacePathLossDb,
  slantRangeM,
} from '../physics/link.ts'
import {
  circularSpeedMS,
  eclipseDurationS,
  eclipseFraction,
  groundTrackSpeedMS,
  orbitalPeriodS,
  semiMajorAxisM,
} from '../physics/orbit.ts'
import { depthOfDischarge, requiredSolarArrayPowerW, solarArrayPowerW } from '../physics/power.ts'
import { degToRad, M_PER_KM } from '../physics/units.ts'
import {
  ALLOWED_DEPTH_OF_DISCHARGE,
  BATTERY_ROUND_TRIP_EFFICIENCY,
  BITS_PER_GB,
  DAYS_PER_YEAR,
  DRAG_COEFFICIENT,
  INSTRUMENT_REFERENCE_ALTITUDE_M,
  LAND_FRACTION,
  LINK_MARGIN_DB,
  MIN_ELEVATION_RAD,
  REQUIRED_EB_N0_DB,
  SOLAR_ARRAY_FADE_PER_YEAR,
  SPACE_WEATHER,
} from './parameters.ts'
import type {
  AttitudeControlPart,
  BatteryPart,
  Catalog,
  Component,
  ComponentCategory,
  ComputerPart,
  Design,
  GroundStation,
  Instrument,
  Launcher,
  Orbit,
  PropulsionPart,
  RadioPart,
  Scenario,
  SolarArrayPart,
  StructurePart,
} from './types.ts'

// --------------------------------------------------------------- resolve ----

/** A design with every id looked up in the catalogue. */
export interface ResolvedDesign {
  orbit: Orbit | null
  launcher: Launcher | null
  structure: StructurePart | null
  solarArray: SolarArrayPart | null
  battery: BatteryPart | null
  computer: ComputerPart | null
  attitudeControl: AttitudeControlPart | null
  propulsion: PropulsionPart | null
  radios: RadioPart[]
  instruments: Instrument[]
  bookings: { station: GroundStation; passesPerDay: number }[]
  imagingMinutesPerDay: number
  /** Ids in the design that are not in the catalogue, or are in the wrong slot. */
  unknownIds: string[]
}

export function resolveDesign(design: Design, catalog: Catalog): ResolvedDesign {
  const unknownIds: string[] = []

  function find<T extends { id: string }>(list: T[], id: string | null): T | null {
    if (id === null) return null
    const found = list.find((entry) => entry.id === id)
    if (!found) unknownIds.push(id)
    return found ?? null
  }

  function part<C extends ComponentCategory>(
    category: C,
    id: string | null,
  ): Extract<Component, { category: C }> | null {
    const sameCategory = catalog.components.filter(
      (entry): entry is Extract<Component, { category: C }> => entry.category === category,
    )
    return find(sameCategory, id)
  }

  const present = <T>(value: T | null): value is T => value !== null

  return {
    orbit: find(catalog.orbits, design.orbitId),
    launcher: find(catalog.launchers, design.launcherId),
    structure: part('structure', design.structureId),
    solarArray: part('solar_array', design.solarArrayId),
    battery: part('battery', design.batteryId),
    computer: part('computer', design.computerId),
    attitudeControl: part('attitude_control', design.attitudeControlId),
    propulsion: part('propulsion', design.propulsionId),
    radios: design.radioIds.map((id) => part('communications', id)).filter(present),
    instruments: design.instrumentIds.map((id) => find(catalog.instruments, id)).filter(present),
    bookings: design.groundStations
      .map(({ stationId, passesPerDay }) => {
        const station = find(catalog.groundStations, stationId)
        return station ? { station, passesPerDay: Math.max(0, passesPerDay) } : null
      })
      .filter(present),
    imagingMinutesPerDay: Math.max(0, design.imagingMinutesPerDay),
    unknownIds,
  }
}

/** Every catalogue part bolted to the spacecraft, instruments included. */
export function fittedParts(resolved: ResolvedDesign): (Component | Instrument)[] {
  const single: (Component | null)[] = [
    resolved.structure,
    resolved.solarArray,
    resolved.battery,
    resolved.computer,
    resolved.attitudeControl,
    resolved.propulsion,
  ]
  return [
    ...single.filter((entry): entry is Component => entry !== null),
    ...resolved.radios,
    ...resolved.instruments,
  ]
}

// ------------------------------------------------------------------ orbit ---

/** Orbit-averaged figures for the chosen orbit, at its starting altitude. */
export interface OrbitFigures {
  altitudeM: number
  inclinationRad: number
  periodS: number
  /** Share of each orbit in Earth's shadow, worst case (Sun in the orbit plane). */
  eclipseFraction: number
  eclipseS: number
  daylightS: number
  /** Longest pass over a station, straight overhead. */
  maxPassS: number
  /** Average pass over a station. */
  meanPassS: number
  groundSpeedMS: number
}

export function orbitFigures(orbit: Orbit): OrbitFigures {
  const altitudeM = orbit.altitude_km * M_PER_KM
  const a = semiMajorAxisM(altitudeM)
  const periodS = orbitalPeriodS(a)
  const eclipseS = eclipseDurationS(a)
  const maxPassS = maxPassDurationS(altitudeM, MIN_ELEVATION_RAD)
  return {
    altitudeM,
    inclinationRad: degToRad(orbit.inclination_deg),
    periodS,
    eclipseFraction: eclipseFraction(a),
    eclipseS,
    daylightS: periodS - eclipseS,
    maxPassS,
    // The station's view of the sky is a circle. Passes cross it at random
    // distances from the centre, and the mean chord of a circle is pi/4 of its
    // diameter. So the average pass is pi/4 of the overhead pass.
    meanPassS: (Math.PI / 4) * maxPassS,
    groundSpeedMS: groundTrackSpeedMS(altitudeM),
  }
}

// ------------------------------------------------------------------- mass ---

/**
 * Launch mass: every part, plus the antenna each radio needs. The thruster's
 * catalogue mass already includes its propellant. Approximation: the mass is
 * held constant for the whole mission (propellant use is not subtracted).
 */
export function totalMassKg(resolved: ResolvedDesign): number {
  const parts = fittedParts(resolved).reduce((sum, entry) => sum + entry.mass_kg, 0)
  const antennas = resolved.radios.reduce((sum, radio) => sum + radio.antenna_mass_kg, 0)
  return parts + antennas
}

// ------------------------------------------------------------------ links ---

/** One booked ground station and the radio that talks to it. */
export interface StationLink {
  stationId: string
  stationName: string
  /** The fastest radio on board this station can hear; null if none. */
  radioId: string | null
  /** Data rate used: the lower of the radio's limit and what the link carries. */
  rateBps: number
  /** What the link budget supports at the lowest elevation, with margin. */
  linkRateBps: number
  /** Passes a day the orbit offers over this station (long-run average). */
  availablePassesPerDay: number
  requestedPassesPerDay: number
  /** Passes used: the request, capped at what the orbit offers. */
  passesPerDay: number
  contactSPerDay: number
  /** Extra power the radio draws while sending, above its standby draw. */
  transmitExtraW: number
  /** A two-way radio reaches this station, so it can send commands up. */
  commands: boolean
}

function standbyW(entry: { standby_power_w?: number }): number {
  return Math.abs(entry.standby_power_w ?? 0)
}

/** The station's receive quality (G/T, dB/K) at a frequency, or null if deaf to it. */
export function stationGOverTDbK(station: GroundStation, frequencyMhz: number): number | null {
  const bands = [
    [station.s_band_rx_min_mhz, station.s_band_rx_max_mhz, station.s_band_g_over_t_db_k],
    [station.x_band_rx_min_mhz, station.x_band_rx_max_mhz, station.x_band_g_over_t_db_k],
  ]
  for (const [min, max, gOverT] of bands) {
    if (min === undefined || max === undefined || gOverT === undefined) continue
    if (frequencyMhz >= min && frequencyMhz <= max) return gOverT
  }
  return null
}

/**
 * Data rate from a radio to a station, from the link budget at the lowest
 * elevation used (the longest range, so the weakest signal of the pass).
 * Returns 0 if the station cannot hear the radio's frequency.
 */
export function linkRateBps(radio: RadioPart, station: GroundStation, altitudeM: number): number {
  const gOverT = stationGOverTDbK(station, radio.frequency_mhz)
  if (gOverT === null) return 0
  const frequencyHz = radio.frequency_mhz * 1e6
  const cn0 = carrierToNoiseDensityDbHz({
    eirpDbw: eirpDbw(radio.rf_power_w, radio.antenna_gain_dbi),
    pathLossDb: freeSpacePathLossDb(slantRangeM(altitudeM, MIN_ELEVATION_RAD), frequencyHz),
    receiverGOverTDbK: gOverT,
  })
  return achievableDataRateBps({
    carrierToNoiseDensityDbHz: cn0,
    requiredEbN0Db: REQUIRED_EB_N0_DB,
    marginDb: LINK_MARGIN_DB,
  })
}

export function stationLinks(resolved: ResolvedDesign, orbit: OrbitFigures): StationLink[] {
  return resolved.bookings.map(({ station, passesPerDay }) => {
    const contactFraction = stationContactFraction({
      altitudeM: orbit.altitudeM,
      inclinationRad: orbit.inclinationRad,
      stationLatitudeRad: degToRad(station.latitude_deg),
      minElevationRad: MIN_ELEVATION_RAD,
    })
    const available = (contactFraction * SOLAR_DAY_S) / orbit.meanPassS
    const used = Math.min(passesPerDay, available)

    let best: RadioPart | null = null
    let bestRate = 0
    let bestLinkRate = 0
    let commands = false
    for (const radio of resolved.radios) {
      const linkRate = linkRateBps(radio, station, orbit.altitudeM)
      if (linkRate <= 0) continue
      if (radio.two_way) commands = true
      const rate = Math.min(radio.max_data_rate_mbps * 1e6, linkRate)
      if (rate > bestRate) {
        best = radio
        bestRate = rate
        bestLinkRate = linkRate
      }
    }

    return {
      stationId: station.id,
      stationName: station.name,
      radioId: best?.id ?? null,
      rateBps: bestRate,
      linkRateBps: bestLinkRate,
      availablePassesPerDay: available,
      requestedPassesPerDay: passesPerDay,
      passesPerDay: used,
      contactSPerDay: used * orbit.meanPassS,
      transmitExtraW: best ? Math.abs(best.power_w) - standbyW(best) : 0,
      commands: commands && used > 0,
    }
  })
}

// ------------------------------------------------------------------- cost ---

export interface CostBudget {
  partsMusd: number
  launchMusd: number
  groundMusd: number
  totalMusd: number
}

/**
 * Mission cost: parts, launch and ground-station passes. A rideshare launch
 * charges a base price for an included mass and a price per extra kilogram.
 * Development and staff costs are not modelled.
 */
export function costBudget(
  resolved: ResolvedDesign,
  massKg: number,
  passes: { stationId: string; passesPerDay: number }[],
  plannedDays: number,
): CostBudget {
  const partsMusd = fittedParts(resolved).reduce((sum, entry) => sum + entry.cost_musd, 0)

  let launchMusd = 0
  const launcher = resolved.launcher
  if (launcher) {
    const extraKg = Math.max(0, massKg - (launcher.included_mass_kg ?? Infinity))
    launchMusd = launcher.cost_musd + extraKg * (launcher.extra_cost_musd_per_kg ?? 0)
  }

  let groundUsd = 0
  for (const { station } of resolved.bookings) {
    const booked = passes.find((entry) => entry.stationId === station.id)?.passesPerDay ?? 0
    groundUsd += booked * plannedDays * station.cost_usd_per_pass
  }
  const groundMusd = groundUsd / 1e6

  return { partsMusd, launchMusd, groundMusd, totalMusd: partsMusd + launchMusd + groundMusd }
}

// ---------------------------------------------------------------- imaging ---

export interface ImagingBudget {
  /** Instruments can take pictures at all (pointing, commands, an instrument). */
  possible: boolean
  requestedSPerDay: number
  /** Time each day spent over sunlit land: the most a camera can use. */
  maxSPerDay: number
  plannedSPerDay: number
  /** Data made per second of imaging by all instruments together. */
  dataRateBps: number
  /** Share of that data that serves the scenario's objective. */
  scienceShare: number
  /** The instrument the requirements are judged on; null if none serves the objective. */
  primary: Instrument | null
  /** Pixel size on the ground for the primary instrument. */
  groundResolutionM: number | null
  swathM: number | null
  /** Time to cover the equator once with the primary instrument's swath. */
  equatorialRevisitDays: number | null
}

/**
 * Data rate of a push-broom camera at a new altitude. The camera reads one
 * line of pixels each time the ground moves by one pixel, so
 *   rate = rate_ref (v_ground / v_ground_ref) (h_ref / h)
 * (ground speed over pixel size; the pixel size grows in proportion to
 * altitude, see groundSampleDistanceM).
 */
export function instrumentDataRateBps(instrument: Instrument, altitudeM: number): number {
  const reference = INSTRUMENT_REFERENCE_ALTITUDE_M
  return (
    instrument.data_rate_mbps *
    1e6 *
    (groundTrackSpeedMS(altitudeM) / groundTrackSpeedMS(reference)) *
    (reference / altitudeM)
  )
}

function instrumentSwathM(instrument: Instrument, altitudeM: number): number {
  return swathWidthM(instrument.swath_km_at_500km * M_PER_KM, INSTRUMENT_REFERENCE_ALTITUDE_M, altitudeM)
}

function instrumentResolutionM(instrument: Instrument, altitudeM: number): number {
  return groundSampleDistanceM(
    instrument.ground_resolution_m_at_500km,
    INSTRUMENT_REFERENCE_ALTITUDE_M,
    altitudeM,
  )
}

function threshold(scenario: Scenario, metric: string): number | null {
  return scenario.requirements.find((entry) => entry.metric === metric)?.threshold ?? null
}

/**
 * The instrument the requirements are judged on: of those that serve the
 * objective, the one that misses the fewest of the resolution and revisit
 * requirements; ties go to the wider view.
 */
function primaryInstrument(
  instruments: Instrument[],
  scenario: Scenario,
  altitudeM: number,
): Instrument | null {
  const maxResolutionM = threshold(scenario, 'ground_resolution_m')
  const maxRevisitDays = threshold(scenario, 'revisit_days')
  let best: Instrument | null = null
  let bestMisses = Infinity
  for (const instrument of instruments) {
    if (!instrument.compatible_objectives.includes(scenario.objective_id)) continue
    const swathM = instrumentSwathM(instrument, altitudeM)
    const revisitDays = equatorialRevisitTimeS(swathM, altitudeM) / SOLAR_DAY_S
    let misses = 0
    if (maxResolutionM !== null && instrumentResolutionM(instrument, altitudeM) > maxResolutionM) misses++
    if (maxRevisitDays !== null && revisitDays > maxRevisitDays) misses++
    const wider = best !== null && swathM > instrumentSwathM(best, altitudeM)
    if (misses < bestMisses || (misses === bestMisses && wider)) {
      best = instrument
      bestMisses = misses
    }
  }
  return best
}

function imagingBudget(
  resolved: ResolvedDesign,
  scenario: Scenario,
  orbit: OrbitFigures,
  commandLink: boolean,
): ImagingBudget {
  const { instruments } = resolved
  const possible = instruments.length > 0 && resolved.attitudeControl !== null && commandLink
  const requestedSPerDay = resolved.imagingMinutesPerDay * 60
  // Approximation: the ground below is in daylight half the time, and land is
  // spread evenly, so the camera is over sunlit land for 0.5 x land share.
  const maxSPerDay = 0.5 * LAND_FRACTION * SOLAR_DAY_S

  let dataRateBps = 0
  let scienceRateBps = 0
  for (const instrument of instruments) {
    const rate = instrumentDataRateBps(instrument, orbit.altitudeM)
    dataRateBps += rate
    if (instrument.compatible_objectives.includes(scenario.objective_id)) scienceRateBps += rate
  }

  const primary = primaryInstrument(instruments, scenario, orbit.altitudeM)
  const swathM = primary ? instrumentSwathM(primary, orbit.altitudeM) : null
  return {
    possible,
    requestedSPerDay,
    maxSPerDay,
    plannedSPerDay: possible ? Math.min(requestedSPerDay, maxSPerDay) : 0,
    dataRateBps,
    scienceShare: dataRateBps > 0 ? scienceRateBps / dataRateBps : 0,
    primary,
    groundResolutionM: primary ? instrumentResolutionM(primary, orbit.altitudeM) : null,
    swathM,
    equatorialRevisitDays:
      swathM === null ? null : equatorialRevisitTimeS(swathM, orbit.altitudeM) / SOLAR_DAY_S,
  }
}

// ------------------------------------------------------------------ power ---

/** What the spacecraft draws, before any load is switched off. */
export interface PowerLoads {
  /** Parts that are always on: computer, attitude control, standby draws. */
  essentialsW: number
  /** Extra draw of the instruments while imaging, averaged over the sunlit time. */
  imagingDaylightW: number
  /** Extra draw of the radios while sending, averaged over the time they may send. */
  transmitW: number
  /** True if the battery can carry a pass in Earth's shadow. */
  transmitInEclipse: boolean
  /** Thruster draw averaged over the sunlit time (it only fires in sunlight). */
  thrusterDaylightW: number
}

/**
 * Solar array output in sunlight. With attitude control the array faces the
 * Sun to within the pointing accuracy. Without it the spacecraft tumbles, and
 * a flat panel turning at random catches on average 1/4 of full sunlight
 * (the mean of max(0, cos) over all directions).
 */
export function sunlitArrayPowerW(resolved: ResolvedDesign, ageYears: number, health = 1): number {
  if (!resolved.solarArray) return 0
  const aimed = solarArrayPowerW({
    peakPowerW: resolved.solarArray.power_w,
    incidenceRad: degToRad(resolved.attitudeControl?.pointing_accuracy_deg ?? 0),
    degradationPerYear: SOLAR_ARRAY_FADE_PER_YEAR,
    ageYears,
  })
  return aimed * health * (resolved.attitudeControl ? 1 : 1 / 4)
}

/**
 * Array power needed in sunlight to run the loads and recharge the battery.
 * `activity` scales the switchable loads between 0 (off) and 1 (as planned).
 */
export function requiredSunlitPowerW(
  loads: PowerLoads,
  orbit: OrbitFigures,
  activity: { imaging: number; transmit: number; thruster: number } = {
    imaging: 1,
    transmit: 1,
    thruster: 1,
  },
): number {
  const transmitW = loads.transmitW * activity.transmit
  return requiredSolarArrayPowerW({
    daylightLoadW:
      loads.essentialsW +
      loads.imagingDaylightW * activity.imaging +
      transmitW +
      loads.thrusterDaylightW * activity.thruster,
    eclipseLoadW: loads.essentialsW + (loads.transmitInEclipse ? transmitW : 0),
    daylightS: orbit.daylightS,
    eclipseS: orbit.eclipseS,
    daylightPathEfficiency: 1,
    eclipsePathEfficiency: BATTERY_ROUND_TRIP_EFFICIENCY,
  })
}

export function essentialsW(resolved: ResolvedDesign): number {
  return (
    Math.abs(resolved.computer?.power_w ?? 0) +
    Math.abs(resolved.attitudeControl?.power_w ?? 0) +
    resolved.radios.reduce((sum, radio) => sum + standbyW(radio), 0) +
    resolved.instruments.reduce((sum, instrument) => sum + standbyW(instrument), 0)
  )
}

/** Day-average extra radio draw for a set of links, in watts. */
export function transmitLoadW(links: StationLink[]): number {
  return links.reduce((sum, link) => sum + link.transmitExtraW * link.contactSPerDay, 0) / SOLAR_DAY_S
}

export interface BatteryBudget {
  capacityWh: number
  /** Share of the battery the always-on parts use in one eclipse. */
  essentialsDepth: number
  /** The same with one full pass of sending data in the eclipse as well. */
  transmitDepth: number
  /** Sending in eclipse keeps the battery within the allowed depth. */
  transmitInEclipse: boolean
}

function batteryBudget(resolved: ResolvedDesign, orbit: OrbitFigures, links: StationLink[]): BatteryBudget {
  const capacityWh = resolved.battery?.capacity_wh ?? 0
  const eclipseLoadW = essentialsW(resolved)
  if (capacityWh <= 0) {
    return {
      capacityWh: 0,
      essentialsDepth: eclipseLoadW > 0 ? Infinity : 0,
      transmitDepth: Infinity,
      transmitInEclipse: false,
    }
  }
  const essentialsDepth = depthOfDischarge({ eclipseLoadW, eclipseS: orbit.eclipseS, capacityWh })
  const transmitExtraW = Math.max(0, ...links.map((link) => link.transmitExtraW))
  const transmitDepth =
    essentialsDepth +
    depthOfDischarge({
      eclipseLoadW: transmitExtraW,
      eclipseS: Math.min(orbit.maxPassS, orbit.eclipseS),
      capacityWh,
    })
  return {
    capacityWh,
    essentialsDepth,
    transmitDepth,
    transmitInEclipse: transmitDepth <= ALLOWED_DEPTH_OF_DISCHARGE,
  }
}

// ------------------------------------------------------------------- drag ---

/**
 * Effective drag area: drag coefficient times the average cross-section of a
 * tumbling spacecraft. For a convex body the average shadow is a quarter of
 * its surface area (Cauchy's formula). A thin deployed panel has two faces,
 * so its average shadow is half its one-sided area.
 */
export function effectiveDragAreaM2(resolved: ResolvedDesign): number {
  if (!resolved.structure) return 0
  const [x, y, z] = resolved.structure.body_size_mm.map((mm) => mm / 1000)
  const bodySurfaceM2 = 2 * (x * y + y * z + x * z)
  const deployedM2 = resolved.solarArray?.deployed_area_m2 ?? 0
  return DRAG_COEFFICIENT * (bodySurfaceM2 / 4 + deployedM2 / 2)
}

export interface DragDay {
  altitudeM: number
  propellantKg: number
  reentered: boolean
  /** Share of the drag the thruster cancelled today, 0 to 1. */
  compensation: number
  /** Thruster draw averaged over the sunlit time, if it runs. */
  thrusterDaylightW: number
}

/** What the thruster would do today if it has power: see `dragDay`. */
export function thrusterDemand(options: {
  altitudeM: number
  effectiveAreaM2: number
  propulsion: PropulsionPart | null
  propellantKg: number
  eclipseFraction: number
}): { dragForceN: number; compensation: number; propellantKg: number; daylightW: number } {
  const { altitudeM, effectiveAreaM2, propulsion, propellantKg } = options
  const forceN = dragForceN(
    atmosphericDensityKgM3(altitudeM, SPACE_WEATHER),
    circularSpeedMS(EARTH_EQUATORIAL_RADIUS_M + altitudeM),
    effectiveAreaM2,
  )
  if (!propulsion || propellantKg <= 0 || forceN <= 0) {
    return { dragForceN: forceN, compensation: 0, propellantKg: 0, daylightW: 0 }
  }
  const sunlitFraction = 1 - options.eclipseFraction
  const thrustN = propulsion.thrust_mn / 1000
  // The thruster fires only in sunlight, so on average it can push with at
  // most thrust x sunlit share.
  let compensation = Math.min(1, (thrustN * sunlitFraction) / forceN)
  // Propellant for one day of thrust F: m = F t / (Isp g0), from the
  // definition of specific impulse.
  let neededKg = (compensation * forceN * SOLAR_DAY_S) / (propulsion.isp_s * STANDARD_GRAVITY_M_S2)
  if (neededKg > propellantKg) {
    compensation *= propellantKg / neededKg
    neededKg = propellantKg
  }
  // Share of the sunlit time spent firing, times the firing power.
  const firingShare = (compensation * forceN) / thrustN / sunlitFraction
  return {
    dragForceN: forceN,
    compensation,
    propellantKg: neededKg,
    daylightW: Math.abs(propulsion.power_w) * firingShare,
  }
}

/**
 * One day of drag. If the thruster runs it cancels part or all of the drag
 * and burns propellant; the rest of the drag lowers the orbit.
 */
export function dragDay(options: {
  altitudeM: number
  massKg: number
  effectiveAreaM2: number
  propulsion: PropulsionPart | null
  propellantKg: number
  eclipseFraction: number
  thrusterRuns: boolean
}): DragDay {
  const demand = thrusterDemand(options)
  const compensation = options.thrusterRuns ? demand.compensation : 0
  const propellantKg = options.propellantKg - (options.thrusterRuns ? demand.propellantKg : 0)
  const thrusterDaylightW = options.thrusterRuns ? demand.daylightW : 0
  if (compensation >= 1) {
    return {
      altitudeM: options.altitudeM,
      propellantKg,
      reentered: false,
      compensation,
      thrusterDaylightW,
    }
  }
  const decay = orbitDecay({
    altitudeM: options.altitudeM,
    massKg: options.massKg,
    effectiveAreaM2: options.effectiveAreaM2 * (1 - compensation),
    weather: SPACE_WEATHER,
    maxDurationS: SOLAR_DAY_S,
  })
  return {
    altitudeM: decay.finalAltitudeM,
    propellantKg,
    reentered: decay.lifetimeS !== null,
    compensation,
    thrusterDaylightW,
  }
}

export interface DragBudget {
  effectiveAreaM2: number
  dragForceN: number
  /** The thruster can be aimed (needs attitude control). */
  thrusterUsable: boolean
  /** Day the orbit decays to re-entry, or null if it outlasts the plan. */
  reentryDay: number | null
}

function dragBudget(
  resolved: ResolvedDesign,
  orbit: OrbitFigures,
  massKg: number,
  plannedDays: number,
): DragBudget {
  const effectiveAreaM2 = effectiveDragAreaM2(resolved)
  const thrusterUsable = resolved.propulsion !== null && resolved.attitudeControl !== null
  const common = {
    massKg,
    effectiveAreaM2,
    propulsion: resolved.propulsion,
    eclipseFraction: orbit.eclipseFraction,
    thrusterRuns: thrusterUsable,
  }
  let altitudeM = orbit.altitudeM
  let propellantKg = resolved.propulsion?.propellant_kg ?? 0
  const dragForceN = thrusterDemand({ ...common, altitudeM, propellantKg }).dragForceN
  let reentryDay: number | null = null
  for (let day = 1; day <= plannedDays; day++) {
    const next = dragDay({ ...common, altitudeM, propellantKg })
    altitudeM = next.altitudeM
    propellantKg = next.propellantKg
    if (next.reentered) {
      reentryDay = day
      break
    }
  }
  return { effectiveAreaM2, dragForceN, thrusterUsable, reentryDay }
}

// ---------------------------------------------------------------- budgets ---

export interface PowerBudget {
  loads: PowerLoads
  /** Sunlit array output at launch and at the end of the planned mission. */
  beginOfLifeW: number
  endOfLifeW: number
  /** Sunlit power needed for everything as planned. */
  requiredW: number
  /** Sunlit power needed for the always-on parts alone. */
  essentialsRequiredW: number
  /** Spare power at end of life as a share of the need; negative if short. */
  margin: number
}

/** Budgets that depend on the orbit. */
export interface MissionBudgets {
  orbit: OrbitFigures
  links: StationLink[]
  /** A two-way radio reaches a booked station, so the team can send commands. */
  commandLink: boolean
  imaging: ImagingBudget
  power: PowerBudget
  battery: BatteryBudget
  drag: DragBudget
  dataGeneratedGbPerDay: number
  downlinkCapacityGbPerDay: number
  /** Spare downlink as a share of the data made; null if no data is made. */
  downlinkMargin: number | null
}

export interface Budgets {
  plannedDays: number
  massKg: number
  cost: CostBudget
  /** Onboard storage: the computer's plus each instrument's own. */
  storageGb: number
  /** null until an orbit is chosen. */
  mission: MissionBudgets | null
}

/** Share of the booked contact time the radios may use for sending. */
export function transmitTimeShare(loads: PowerLoads, orbit: OrbitFigures): number {
  return loads.transmitInEclipse ? 1 : 1 - orbit.eclipseFraction
}

export function downlinkCapacityGbPerDay(links: StationLink[], timeShare: number): number {
  return links.reduce((sum, link) => sum + link.rateBps * link.contactSPerDay * timeShare, 0) / BITS_PER_GB
}

export function plannedDays(scenario: Scenario): number {
  return Math.round(scenario.planned_lifetime_years * DAYS_PER_YEAR)
}

export function computeBudgets(resolved: ResolvedDesign, scenario: Scenario): Budgets {
  const days = plannedDays(scenario)
  const massKg = totalMassKg(resolved)
  const storageGb =
    (resolved.computer?.storage_gb ?? 0) +
    resolved.instruments.reduce((sum, instrument) => sum + (instrument.storage_gb ?? 0), 0)

  if (!resolved.orbit) {
    const requested = resolved.bookings.map(({ station, passesPerDay }) => ({
      stationId: station.id,
      passesPerDay,
    }))
    return {
      plannedDays: days,
      massKg,
      cost: costBudget(resolved, massKg, requested, days),
      storageGb,
      mission: null,
    }
  }

  const orbit = orbitFigures(resolved.orbit)
  const links = stationLinks(resolved, orbit)
  const commandLink = links.some((link) => link.commands)
  const imaging = imagingBudget(resolved, scenario, orbit, commandLink)
  const battery = batteryBudget(resolved, orbit, links)
  const drag = dragBudget(resolved, orbit, massKg, days)

  const imagingExtraW = resolved.instruments.reduce(
    (sum, instrument) => sum + Math.abs(instrument.power_w) - standbyW(instrument),
    0,
  )
  const thruster = thrusterDemand({
    altitudeM: orbit.altitudeM,
    effectiveAreaM2: drag.effectiveAreaM2,
    propulsion: resolved.propulsion,
    propellantKg: resolved.propulsion?.propellant_kg ?? 0,
    eclipseFraction: orbit.eclipseFraction,
  })
  const loads: PowerLoads = {
    essentialsW: essentialsW(resolved),
    imagingDaylightW: (imagingExtraW * imaging.plannedSPerDay) / (SOLAR_DAY_S * (1 - orbit.eclipseFraction)),
    transmitW: transmitLoadW(links),
    transmitInEclipse: battery.transmitInEclipse,
    thrusterDaylightW: drag.thrusterUsable ? thruster.daylightW : 0,
  }
  const requiredW = requiredSunlitPowerW(loads, orbit)
  const endOfLifeW = sunlitArrayPowerW(resolved, scenario.planned_lifetime_years)
  const power: PowerBudget = {
    loads,
    beginOfLifeW: sunlitArrayPowerW(resolved, 0),
    endOfLifeW,
    requiredW,
    essentialsRequiredW: requiredSunlitPowerW(loads, orbit, { imaging: 0, transmit: 0, thruster: 0 }),
    margin: requiredW > 0 ? (endOfLifeW - requiredW) / requiredW : 0,
  }

  const dataGeneratedGbPerDay = (imaging.dataRateBps * imaging.plannedSPerDay) / BITS_PER_GB
  const capacity = downlinkCapacityGbPerDay(links, transmitTimeShare(loads, orbit))

  return {
    plannedDays: days,
    massKg,
    cost: costBudget(resolved, massKg, links, days),
    storageGb,
    mission: {
      orbit,
      links,
      commandLink,
      imaging,
      power,
      battery,
      drag,
      dataGeneratedGbPerDay,
      downlinkCapacityGbPerDay: capacity,
      downlinkMargin:
        dataGeneratedGbPerDay > 0 ? (capacity - dataGeneratedGbPerDay) / dataGeneratedGbPerDay : null,
    },
  }
}
