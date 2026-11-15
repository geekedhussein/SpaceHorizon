// Ground-station contact and imaging coverage from orbit geometry.
// Pure functions, SI units and radians. Circular orbits over a spherical Earth.
//
// Reference: [SMAD] J. R. Wertz, D. F. Everett, J. J. Puschell (eds.), Space
// Mission Engineering: The New SMAD, space mission geometry (Earth coverage
// and ground-station passes). The contact-fraction average is our own
// derivation from the spherical law of cosines; see docs/model-assumptions.md.

import { EARTH_EQUATORIAL_RADIUS_M } from './constants.ts'
import { orbitalPeriodS, semiMajorAxisM } from './orbit.ts'

/**
 * Earth central angle between a ground station and the point below the
 * spacecraft, when the spacecraft is seen at the minimum usable elevation:
 *   lambda = acos(R_E cos(el) / (R_E + h)) - el
 * The station can talk to the spacecraft whenever the point below it is within
 * this angle of the station. [SMAD].
 */
export function earthCentralAngleRad(altitudeM: number, minElevationRad: number): number {
  return (
    Math.acos(
      (EARTH_EQUATORIAL_RADIUS_M * Math.cos(minElevationRad)) /
        (EARTH_EQUATORIAL_RADIUS_M + altitudeM),
    ) - minElevationRad
  )
}

/**
 * Longest possible pass, when the spacecraft flies straight over the station:
 *   T_max = T (2 lambda / 2 pi)
 * Approximation: Earth's rotation during the pass is ignored. [SMAD].
 */
export function maxPassDurationS(altitudeM: number, minElevationRad: number): number {
  const lambda = earthCentralAngleRad(altitudeM, minElevationRad)
  return (orbitalPeriodS(semiMajorAxisM(altitudeM)) * lambda) / Math.PI
}

/**
 * Long-run fraction of time a spacecraft is in view of one ground station.
 *
 * At argument of latitude u the point below the spacecraft is at latitude
 * delta, with sin(delta) = sin(i) sin(u). The station at latitude phi sees the
 * spacecraft when their longitudes differ by less than dL, where (spherical
 * law of cosines)
 *   cos(dL) = (cos(lambda) - sin(phi) sin(delta)) / (cos(phi) cos(delta))
 * Earth's rotation and the drift of the orbit plane spread the longitude
 * difference evenly over many orbits, so the chance of being in view at that
 * u is dL / pi. The result is the average of dL / pi over one orbit.
 *
 * Approximations: circular orbit, spherical Earth, a long-run average (it does
 * not give the time of any single pass), and an orbit whose ground track does
 * not repeat exactly.
 */
export function stationContactFraction(options: {
  altitudeM: number
  inclinationRad: number
  stationLatitudeRad: number
  minElevationRad: number
  /** Number of points around the orbit used for the average. */
  steps?: number
}): number {
  const { altitudeM, inclinationRad, stationLatitudeRad, minElevationRad, steps = 720 } = options
  const cosLambda = Math.cos(earthCentralAngleRad(altitudeM, minElevationRad))
  const sinPhi = Math.sin(stationLatitudeRad)
  const cosPhi = Math.cos(stationLatitudeRad)
  const sinI = Math.sin(inclinationRad)

  let sum = 0
  for (let k = 0; k < steps; k++) {
    const u = (2 * Math.PI * (k + 0.5)) / steps
    const sinDelta = sinI * Math.sin(u)
    const cosDelta = Math.sqrt(1 - sinDelta ** 2)
    const numerator = cosLambda - sinPhi * sinDelta
    const denominator = cosPhi * cosDelta
    if (denominator < 1e-12) {
      // Station or spacecraft over a pole: every longitude is the same place.
      sum += numerator <= 0 ? 1 : 0
    } else {
      sum += Math.acos(Math.min(1, Math.max(-1, numerator / denominator))) / Math.PI
    }
  }
  return sum / steps
}

/**
 * Size on the ground of one pixel of a camera looking straight down, at a new
 * altitude: GSD = GSD_ref (h / h_ref). From similar triangles (pixel size over
 * focal length equals ground size over altitude).
 */
export function groundSampleDistanceM(
  referenceGsdM: number,
  referenceAltitudeM: number,
  altitudeM: number,
): number {
  return (referenceGsdM * altitudeM) / referenceAltitudeM
}

/**
 * Width of the strip a camera sees, at a new altitude:
 *   swath = swath_ref (h / h_ref)
 * Approximation: flat ground under the camera, good for narrow fields of view.
 */
export function swathWidthM(
  referenceSwathM: number,
  referenceAltitudeM: number,
  altitudeM: number,
): number {
  return (referenceSwathM * altitudeM) / referenceAltitudeM
}

/**
 * Time for a camera looking straight down to image the whole equator once:
 *   t = (2 pi R_E / swath) T
 * The equator is where neighbouring ground tracks are furthest apart, so this
 * is the slowest place to cover.
 *
 * Approximations: one imaging pass per orbit (the daylight half), strips laid
 * side by side with no overlap and no gaps, no pointing off to the side, no
 * cloud. See docs/model-assumptions.md.
 */
export function equatorialRevisitTimeS(swathWidthM: number, altitudeM: number): number {
  const orbitsNeeded = (2 * Math.PI * EARTH_EQUATORIAL_RADIUS_M) / swathWidthM
  return orbitsNeeded * orbitalPeriodS(semiMajorAxisM(altitudeM))
}
