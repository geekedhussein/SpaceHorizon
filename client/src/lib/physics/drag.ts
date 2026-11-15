// Orbit decay from atmospheric drag, for low circular orbits.
// Pure functions, SI units except where the source model is defined in km.
//
// Source: "Satellite Orbital Decay Calculations", IPS Radio and Space Services,
// The Australian Space Weather Agency (Bureau of Meteorology).
// https://www.sws.bom.gov.au/Category/Educational/Space%20Weather/Space%20Weather%20Effects/SatelliteOrbitalDecayCalculations.pdf
//
// The paper gives a simple density model fitted to standard atmosphere models
// and a period-decay equation, and iterates them. It states the model is for
// essentially circular orbits between 180 and 500 km, and that even the best
// predictions are only good to about 10% of the remaining lifetime.

import { EARTH_EQUATORIAL_RADIUS_M, EARTH_TROPICAL_YEAR_S, SOLAR_DAY_S } from './constants.ts'
import { orbitalPeriodS, semiMajorAxisFromPeriodM, semiMajorAxisM } from './orbit.ts'
import { M_PER_KM } from './units.ts'

/** The paper assumes re-entry once the spacecraft is below this altitude. */
export const REENTRY_ALTITUDE_M = 180 * M_PER_KM

/** Top of the altitude range the density model was fitted for. */
export const DENSITY_MODEL_MAX_ALTITUDE_M = 500 * M_PER_KM

/**
 * Above this altitude the fitted "molecular mass" term is too far from its
 * range to mean anything (it reaches zero at 2450 km), so we refuse to
 * extrapolate further. This is a guard, not a physical boundary.
 */
export const DENSITY_EXTRAPOLATION_LIMIT_M = 1000 * M_PER_KM

/** Space weather inputs to the density model. */
export interface SpaceWeather {
  /** Solar 10.7 cm radio flux in solar flux units, usually a 90-day average. */
  f107Sfu: number
  /** Planetary geomagnetic A index. */
  ap: number
}

/**
 * Air density at orbital altitude, from the paper's model:
 *   T = 900 + 2.5 (F10.7 - 70) + 1.5 Ap        (K)
 *   m = 27 - 0.012 (h - 200)                   (h in km, 180 < h < 500)
 *   H = T / m                                  (km)
 *   rho = 6e-10 exp(-(h - 175) / H)            (kg/m^3)
 * Above 500 km this is an extrapolation of the fit; see
 * docs/model-assumptions.md.
 */
export function atmosphericDensityKgM3(altitudeM: number, weather: SpaceWeather): number {
  if (altitudeM > DENSITY_EXTRAPOLATION_LIMIT_M) {
    throw new RangeError('The drag density model cannot be used above 1000 km.')
  }
  const altitudeKm = altitudeM / M_PER_KM
  const temperatureK = 900 + 2.5 * (weather.f107Sfu - 70) + 1.5 * weather.ap
  const molecularMass = 27 - 0.012 * (altitudeKm - 200)
  const scaleHeightKm = temperatureK / molecularMass
  return 6e-10 * Math.exp(-(altitudeKm - 175) / scaleHeightKm)
}

/**
 * Rate at which drag shortens the orbital period (seconds per second,
 * returned as a positive number):
 *   -dP/dt = 3 pi a rho (A_e / m)
 * A_e is the effective area, the cross-section times the drag coefficient.
 */
export function periodDecayRate(
  semiMajorAxisM: number,
  densityKgM3: number,
  effectiveAreaM2: number,
  massKg: number,
): number {
  return (3 * Math.PI * semiMajorAxisM * densityKgM3 * effectiveAreaM2) / massKg
}

/**
 * Drag force on the spacecraft: F = (1/2) rho v^2 A_e, with A_e the effective
 * area (cross-section times drag coefficient). This is the standard drag
 * equation; the paper's period-decay rate follows from it, because the work
 * done by drag, F v, lowers the orbit's energy -GM m / (2a).
 */
export function dragForceN(densityKgM3: number, speedMS: number, effectiveAreaM2: number): number {
  return 0.5 * densityKgM3 * speedMS ** 2 * effectiveAreaM2
}

export interface OrbitDecay {
  /** Time until re-entry, or null if the orbit outlasts `maxDurationS`. */
  lifetimeS: number | null
  /** Altitude when the calculation stopped. */
  finalAltitudeM: number
  /** True if any step used the density model above its fitted range (500 km). */
  extrapolated: boolean
}

/**
 * Time for drag to bring a circular orbit down to re-entry. Follows the
 * paper's program: step forward in time, shorten the period by dP/dt x step,
 * get the new altitude from Kepler's third law, stop below 180 km.
 *
 * Approximations: circular orbit, constant space weather, constant effective
 * area, fixed time step (the paper's 0.1 day by default).
 */
export function orbitDecay(options: {
  altitudeM: number
  massKg: number
  /** Cross-section area times drag coefficient (the paper suggests about 2). */
  effectiveAreaM2: number
  weather: SpaceWeather
  stepS?: number
  maxDurationS?: number
}): OrbitDecay {
  const {
    massKg,
    effectiveAreaM2,
    weather,
    stepS = 0.1 * SOLAR_DAY_S,
    maxDurationS = 100 * EARTH_TROPICAL_YEAR_S,
  } = options

  let altitudeM = options.altitudeM
  let periodS = orbitalPeriodS(semiMajorAxisM(altitudeM))
  let elapsedS = 0
  let extrapolated = false

  while (altitudeM >= REENTRY_ALTITUDE_M) {
    if (elapsedS >= maxDurationS) {
      return { lifetimeS: null, finalAltitudeM: altitudeM, extrapolated }
    }
    if (altitudeM > DENSITY_MODEL_MAX_ALTITUDE_M) extrapolated = true
    const densityKgM3 = atmosphericDensityKgM3(altitudeM, weather)
    const rate = periodDecayRate(semiMajorAxisM(altitudeM), densityKgM3, effectiveAreaM2, massKg)
    periodS -= rate * stepS
    elapsedS += stepS
    altitudeM = semiMajorAxisFromPeriodM(periodS) - EARTH_EQUATORIAL_RADIUS_M
  }
  return { lifetimeS: elapsedS, finalAltitudeM: altitudeM, extrapolated }
}
