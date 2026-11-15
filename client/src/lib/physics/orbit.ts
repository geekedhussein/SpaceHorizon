// First-order orbit equations: period, speed, precession, eclipse, transfers.
// Pure functions, SI units and radians. Two-body motion plus the secular J2 term.
//
// References:
//   [Vallado] D. A. Vallado, Fundamentals of Astrodynamics and Applications
//   [SMAD]    J. R. Wertz, D. F. Everett, J. J. Puschell (eds.), Space Mission
//             Engineering: The New SMAD
//   [Curtis]  H. D. Curtis, Orbital Mechanics for Engineering Students

import {
  EARTH_EQUATORIAL_RADIUS_M,
  EARTH_GM_M3_S2,
  EARTH_J2,
  EARTH_TROPICAL_YEAR_S,
  SOLAR_DAY_S,
} from './constants.ts'

/**
 * Semi-major axis of a circular orbit at a given altitude: a = R_E + h.
 * Altitude is measured from the equatorial radius, the convention used in
 * launch-provider user guides.
 */
export function semiMajorAxisM(altitudeM: number): number {
  return EARTH_EQUATORIAL_RADIUS_M + altitudeM
}

/** Kepler's third law: T = 2 pi sqrt(a^3 / GM). [Curtis], two-body orbits. */
export function orbitalPeriodS(semiMajorAxisM: number, gmM3S2 = EARTH_GM_M3_S2): number {
  return 2 * Math.PI * Math.sqrt(semiMajorAxisM ** 3 / gmM3S2)
}

/** Kepler's third law solved for a: a = (GM (T / 2 pi)^2)^(1/3). */
export function semiMajorAxisFromPeriodM(periodS: number, gmM3S2 = EARTH_GM_M3_S2): number {
  return Math.cbrt(gmM3S2 * (periodS / (2 * Math.PI)) ** 2)
}

/** Mean motion: n = sqrt(GM / a^3), in rad/s. */
export function meanMotionRadS(semiMajorAxisM: number, gmM3S2 = EARTH_GM_M3_S2): number {
  return Math.sqrt(gmM3S2 / semiMajorAxisM ** 3)
}

/**
 * Vis-viva equation: v = sqrt(GM (2/r - 1/a)). Speed at distance r from Earth's
 * centre on an orbit with semi-major axis a. [Curtis], two-body orbits.
 */
export function visVivaSpeedMS(
  radiusM: number,
  semiMajorAxisM: number,
  gmM3S2 = EARTH_GM_M3_S2,
): number {
  return Math.sqrt(gmM3S2 * (2 / radiusM - 1 / semiMajorAxisM))
}

/** Speed on a circular orbit: vis-viva with r = a. */
export function circularSpeedMS(radiusM: number, gmM3S2 = EARTH_GM_M3_S2): number {
  return visVivaSpeedMS(radiusM, radiusM, gmM3S2)
}

/**
 * Speed of the point directly below the spacecraft along the ground, for a
 * circular orbit: v_ground = v R_E / (R_E + h).
 * Approximation: Earth's rotation is ignored. The ground moves at up to
 * 0.47 km/s at the equator, about 7% of the result in low orbit.
 */
export function groundTrackSpeedMS(altitudeM: number): number {
  const r = semiMajorAxisM(altitudeM)
  return (circularSpeedMS(r) * EARTH_EQUATORIAL_RADIUS_M) / r
}

/** Orbits completed per mean solar day. */
export function orbitsPerDay(semiMajorAxisM: number): number {
  return SOLAR_DAY_S / orbitalPeriodS(semiMajorAxisM)
}

/**
 * Secular drift of the orbit plane caused by Earth's oblateness:
 *   dOmega/dt = -(3/2) J2 (R_E / p)^2 n cos(i),   p = a (1 - e^2)
 * In rad/s; negative means the plane drifts westward. [Vallado], J2 secular
 * perturbations.
 */
export function nodalPrecessionRadS(
  semiMajorAxisM: number,
  inclinationRad: number,
  eccentricity = 0,
): number {
  const p = semiMajorAxisM * (1 - eccentricity ** 2)
  return (
    -1.5 *
    EARTH_J2 *
    (EARTH_EQUATORIAL_RADIUS_M / p) ** 2 *
    meanMotionRadS(semiMajorAxisM) *
    Math.cos(inclinationRad)
  )
}

/**
 * Inclination that makes an orbit sun-synchronous: the plane must drift
 * eastward by one full turn per tropical year, so
 *   cos(i) = -(2 pi / T_year) / ((3/2) J2 (R_E / p)^2 n)
 * Returns null when no inclination works (the orbit is too high). [Vallado].
 */
export function sunSynchronousInclinationRad(
  semiMajorAxisM: number,
  eccentricity = 0,
): number | null {
  const requiredRateRadS = (2 * Math.PI) / EARTH_TROPICAL_YEAR_S
  const p = semiMajorAxisM * (1 - eccentricity ** 2)
  const rateAtZeroInclination =
    1.5 * EARTH_J2 * (EARTH_EQUATORIAL_RADIUS_M / p) ** 2 * meanMotionRadS(semiMajorAxisM)
  const cosI = -requiredRateRadS / rateAtZeroInclination
  return cosI < -1 ? null : Math.acos(cosI)
}

/**
 * Fraction of a circular orbit spent in Earth's shadow.
 *
 * Beta is the angle between the Sun direction and the orbit plane. With theta
 * the orbit angle measured from the point furthest from the Sun, the
 * spacecraft's distance from the Earth-Sun line is r sqrt(1 - cos^2(beta)
 * cos^2(theta)). It is in shadow while that distance is below R_E, so the
 * shadow half-angle is
 *   cos(theta_s) = sqrt(1 - (R_E / r)^2) / cos(beta)
 * and the fraction is theta_s / pi. [SMAD], eclipse duration.
 *
 * Approximations: the shadow is a cylinder (no penumbra) and Earth is a sphere
 * of equatorial radius. beta = 0 is the worst case (longest eclipse).
 */
export function eclipseFraction(semiMajorAxisM: number, betaRad = 0): number {
  const horizon = Math.sqrt(1 - (EARTH_EQUATORIAL_RADIUS_M / semiMajorAxisM) ** 2)
  const cosBeta = Math.cos(betaRad)
  if (horizon >= cosBeta) return 0
  return Math.acos(horizon / cosBeta) / Math.PI
}

/** Time in shadow on each orbit, for a circular orbit. */
export function eclipseDurationS(semiMajorAxisM: number, betaRad = 0): number {
  return eclipseFraction(semiMajorAxisM, betaRad) * orbitalPeriodS(semiMajorAxisM)
}

export interface HohmannTransfer {
  /** First burn, leaving the starting orbit. */
  deltaV1MS: number
  /** Second burn, entering the final orbit. */
  deltaV2MS: number
  totalDeltaVMS: number
  /** Half the period of the transfer ellipse. */
  transferTimeS: number
}

/**
 * Hohmann transfer between two circular, coplanar orbits of radius r1 and r2.
 * The transfer ellipse has a_t = (r1 + r2) / 2; each burn is the difference
 * between the vis-viva speed on the ellipse and the circular speed.
 * [Vallado], Hohmann transfer.
 */
export function hohmannTransfer(
  radius1M: number,
  radius2M: number,
  gmM3S2 = EARTH_GM_M3_S2,
): HohmannTransfer {
  const aTransfer = (radius1M + radius2M) / 2
  const deltaV1MS = Math.abs(
    visVivaSpeedMS(radius1M, aTransfer, gmM3S2) - circularSpeedMS(radius1M, gmM3S2),
  )
  const deltaV2MS = Math.abs(
    circularSpeedMS(radius2M, gmM3S2) - visVivaSpeedMS(radius2M, aTransfer, gmM3S2),
  )
  return {
    deltaV1MS,
    deltaV2MS,
    totalDeltaVMS: deltaV1MS + deltaV2MS,
    transferTimeS: orbitalPeriodS(aTransfer, gmM3S2) / 2,
  }
}
