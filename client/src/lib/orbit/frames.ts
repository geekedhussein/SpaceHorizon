// Reference frames and the sky: time scales, Earth's rotation, the Sun's
// direction, and points on the ground. Pure functions; time comes in as a
// number (milliseconds since 1970-01-01 UTC), never from the clock.
//
// Frames:
//   ECI   Earth-centred inertial: x to the March equinox, z to the north pole.
//   ECEF  Earth-centred, Earth-fixed: x through latitude 0, longitude 0;
//         z to the north pole. It turns with Earth.
//
// Approximations (listed in docs/model-assumptions.md): UTC is used as UT1
// (they differ by less than 0.9 s); Earth is a sphere of equatorial radius, as
// in /lib/physics; precession, nutation and polar motion are ignored apart
// from what the sidereal-time and Sun formulas already contain.

import { EARTH_EQUATORIAL_RADIUS_M } from '../physics/constants.ts'
import { degToRad } from '../physics/units.ts'
import { dot, length, subtract, wrapTwoPi } from './kepler.ts'
import type { Vec3 } from './kepler.ts'

const MS_PER_DAY = 86_400_000

/** Julian date of the Unix epoch, 1970-01-01 00:00 UTC (by definition). */
const UNIX_EPOCH_JD = 2_440_587.5
/** Julian date of J2000.0, 2000-01-01 12:00. */
const J2000_JD = 2_451_545.0

export function julianDate(unixMs: number): number {
  return unixMs / MS_PER_DAY + UNIX_EPOCH_JD
}

/** Days since J2000.0. */
export function daysSinceJ2000(unixMs: number): number {
  return julianDate(unixMs) - J2000_JD
}

/**
 * Greenwich mean sidereal time: the angle between the March equinox and the
 * Greenwich meridian, which is how far Earth has turned.
 *   GMST = 18.697374558 + 24.06570982441908 D   hours, D = days since J2000.0
 * US Naval Observatory, "Computing Greenwich Apparent Sidereal Time"
 * (https://aa.usno.navy.mil/faq/GAST); loses about 0.1 s per century.
 */
export function gmstRad(unixMs: number): number {
  const hours = 18.697374558 + 24.06570982441908 * daysSinceJ2000(unixMs)
  return wrapTwoPi((hours / 24) * 2 * Math.PI)
}

export interface SunPosition {
  /** Mean longitude: where a Sun moving at a steady rate would be. */
  meanLongitudeRad: number
  /** Longitude along the ecliptic, the plane of Earth's orbit. */
  eclipticLongitudeRad: number
  /** Tilt of Earth's axis to the ecliptic. */
  obliquityRad: number
  rightAscensionRad: number
  declinationRad: number
  /** Unit vector from Earth to the Sun in the inertial frame. */
  directionEci: Vec3
}

/**
 * Where the Sun is, from the low-precision formulas of the Astronomical
 * Almanac (page C24), good to about 0.01 degree for 1950 to 2050:
 *   n = days since J2000.0
 *   L = 280.460 + 0.9856474 n          mean longitude, degrees
 *   g = 357.528 + 0.9856003 n          mean anomaly, degrees
 *   lambda = L + 1.915 sin g + 0.020 sin 2g     ecliptic longitude
 *   epsilon = 23.439 - 0.0000004 n     obliquity
 * The Sun's ecliptic latitude is taken as zero. Sources in docs/sources.md.
 */
export function sunPosition(unixMs: number): SunPosition {
  const n = daysSinceJ2000(unixMs)
  const meanLongitudeRad = wrapTwoPi(degToRad(280.46 + 0.9856474 * n))
  const g = degToRad(357.528 + 0.9856003 * n)
  const lambda = wrapTwoPi(meanLongitudeRad + degToRad(1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)))
  const epsilon = degToRad(23.439 - 0.0000004 * n)
  const directionEci: Vec3 = [
    Math.cos(lambda),
    Math.cos(epsilon) * Math.sin(lambda),
    Math.sin(epsilon) * Math.sin(lambda),
  ]
  return {
    meanLongitudeRad,
    eclipticLongitudeRad: lambda,
    obliquityRad: epsilon,
    rightAscensionRad: wrapTwoPi(Math.atan2(directionEci[1], directionEci[0])),
    declinationRad: Math.asin(directionEci[2]),
    directionEci,
  }
}

/** Rotate about the z axis (the pole) by an angle. */
function rotateZ(v: Vec3, angleRad: number): Vec3 {
  const c = Math.cos(angleRad)
  const s = Math.sin(angleRad)
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]
}

/** Inertial to Earth-fixed: undo Earth's rotation. */
export function eciToEcef(v: Vec3, gmst: number): Vec3 {
  return rotateZ(v, -gmst)
}

/** Earth-fixed to inertial. */
export function ecefToEci(v: Vec3, gmst: number): Vec3 {
  return rotateZ(v, gmst)
}

/** A point at a latitude, longitude and height, in the Earth-fixed frame. */
export function geographicToEcefM(latitudeRad: number, longitudeRad: number, heightM = 0): Vec3 {
  const r = EARTH_EQUATORIAL_RADIUS_M + heightM
  return [
    r * Math.cos(latitudeRad) * Math.cos(longitudeRad),
    r * Math.cos(latitudeRad) * Math.sin(longitudeRad),
    r * Math.sin(latitudeRad),
  ]
}

export interface GroundPoint {
  latitudeRad: number
  /** East positive, in (-pi, pi]. */
  longitudeRad: number
  heightM: number
}

/** The point on the ground directly below an Earth-fixed position. */
export function ecefToGeographic(v: Vec3): GroundPoint {
  const r = length(v)
  return {
    latitudeRad: Math.asin(v[2] / r),
    longitudeRad: Math.atan2(v[1], v[0]),
    heightM: r - EARTH_EQUATORIAL_RADIUS_M,
  }
}

/**
 * How high above a station's horizon a target stands. Both in the same frame.
 * Negative means below the horizon.
 */
export function elevationRad(station: Vec3, target: Vec3): number {
  const toTarget = subtract(target, station)
  return Math.asin(dot(toTarget, station) / (length(toTarget) * length(station)))
}

/**
 * True if a point is in Earth's shadow. The shadow is a cylinder behind Earth,
 * the same model as eclipseFraction in /lib/physics (no half-shadow).
 */
export function inEarthShadow(positionM: Vec3, sunDirection: Vec3): boolean {
  const along = dot(positionM, sunDirection)
  if (along >= 0) return false
  const offAxis = Math.sqrt(Math.max(0, dot(positionM, positionM) - along * along))
  return offAxis < EARTH_EQUATORIAL_RADIUS_M
}

/** The place on the ground where the Sun is straight overhead. */
export function sunSubpoint(unixMs: number): GroundPoint {
  const sun = sunPosition(unixMs)
  const below = ecefToGeographic(eciToEcef(sun.directionEci, gmstRad(unixMs)))
  return { latitudeRad: below.latitudeRad, longitudeRad: below.longitudeRad, heightM: 0 }
}

/**
 * Latitude of the line between day and night at a given longitude. On that
 * line the Sun is on the horizon: the ground direction n and the Sun direction
 * s are at right angles, n . s = 0, which gives
 *   tan(lat) = -cos(lon - lon_sun) / tan(lat_sun)
 * Night lies on the side away from the Sun's latitude.
 */
export function terminatorLatitudeRad(longitudeRad: number, sun: GroundPoint): number {
  // At an equinox the line runs through both poles; keep the tangent finite.
  const sunLatitude = Math.abs(sun.latitudeRad) < 1e-6 ? 1e-6 : sun.latitudeRad
  return Math.atan(-Math.cos(longitudeRad - sun.longitudeRad) / Math.tan(sunLatitude))
}
