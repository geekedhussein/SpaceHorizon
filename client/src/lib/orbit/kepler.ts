// Kepler propagation: where a spacecraft is on its orbit at a given time.
// Pure functions in SI units (metres, seconds, radians). The recipe follows
// NASA's mission-viz "Elliptical Orbit Design" tutorial
// (https://nasa.github.io/mission-viz/).
//
// Frame: Earth-centred inertial (ECI). x points to the March equinox, z to the
// north pole, y completes the right-handed set. Earth turns beneath this frame
// (see frames.ts).
//
// Two-body motion plus one correction: Earth's bulge (J2) slowly turns the
// orbit plane. Without it a Sun-synchronous orbit would not exist.

import { nodalPrecessionRadS, orbitalPeriodS } from '../physics/orbit.ts'

export type Vec3 = [number, number, number]

const TWO_PI = 2 * Math.PI

/** Classical orbital elements. Angles in radians, lengths in metres. */
export interface OrbitalElements {
  /** Semi-major axis `a`: half the long axis of the ellipse. */
  semiMajorAxisM: number
  /** Eccentricity `e`: 0 is a circle. */
  eccentricity: number
  /** Inclination `i`: tilt of the orbit plane to the equator. */
  inclinationRad: number
  /** Argument of perigee `w`: angle from the ascending node to the lowest point. */
  argumentOfPerigeeRad: number
  /** Right ascension of the ascending node `O` at t = 0. */
  raanRad: number
  /** Time of perigee passage `tau`, in seconds from t = 0. */
  timeOfPerigeeS: number
}

/** Wrap an angle to [0, 2 pi). */
export function wrapTwoPi(angleRad: number): number {
  const wrapped = angleRad % TWO_PI
  return wrapped < 0 ? wrapped + TWO_PI : wrapped
}

/** Period `T` from Kepler's third law (the same function the simulation uses). */
export function periodS(elements: OrbitalElements): number {
  return orbitalPeriodS(elements.semiMajorAxisM)
}

/** Mean anomaly: M = 2 pi (t - tau) / T, wrapped to [0, 2 pi). */
export function meanAnomalyRad(tS: number, timeOfPerigeeS: number, orbitPeriodS: number): number {
  return wrapTwoPi((TWO_PI * (tS - timeOfPerigeeS)) / orbitPeriodS)
}

/**
 * Solve Kepler's equation M = E - e sin(E) for the eccentric anomaly E, by
 * Newton's method: E <- E - (E - e sin E - M) / (1 - e cos E). Stops when the
 * change is below 1e-10 rad, or after 50 steps. For closed orbits, 0 <= e < 1.
 */
export function solveKepler(meanAnomaly: number, eccentricity: number): number {
  // Starting at pi is safe for very stretched orbits, where M is a poor guess.
  let E = eccentricity < 0.8 ? meanAnomaly : Math.PI
  for (let step = 0; step < 50; step++) {
    const change = (E - eccentricity * Math.sin(E) - meanAnomaly) / (1 - eccentricity * Math.cos(E))
    E -= change
    if (Math.abs(change) < 1e-10) break
  }
  return E
}

/**
 * Position in the orbit plane, x towards perigee:
 *   x = a (cos E - e),  y = a sqrt(1 - e^2) sin E,  z = 0
 */
export function positionInPlaneM(elements: OrbitalElements, eccentricAnomaly: number): Vec3 {
  const { semiMajorAxisM: a, eccentricity: e } = elements
  return [a * (Math.cos(eccentricAnomaly) - e), a * Math.sqrt(1 - e * e) * Math.sin(eccentricAnomaly), 0]
}

/**
 * Turn a point in the orbit plane into the inertial frame: rotate by the
 * argument of perigee `w` about z, the inclination `i` about x, then the node
 * `O` about z.
 */
export function planeToEci(point: Vec3, argumentOfPerigeeRad: number, inclinationRad: number, raanRad: number): Vec3 {
  const [px, py] = point
  const x = px * Math.cos(argumentOfPerigeeRad) - py * Math.sin(argumentOfPerigeeRad)
  const y = px * Math.sin(argumentOfPerigeeRad) + py * Math.cos(argumentOfPerigeeRad)
  const cosI = Math.cos(inclinationRad)
  return [
    x * Math.cos(raanRad) - y * cosI * Math.sin(raanRad),
    x * Math.sin(raanRad) + y * cosI * Math.cos(raanRad),
    y * Math.sin(inclinationRad),
  ]
}

/**
 * The ascending node at time t. Earth's bulge turns the orbit plane at a
 * steady rate (see nodalPrecessionRadS in /lib/physics).
 * Approximation: only this drift of the node is modelled. The J2 drift of the
 * perigee and of the mean motion are left out; every orbit in the game is
 * circular, where the perigee has no meaning.
 */
export function raanAtRad(elements: OrbitalElements, tS: number): number {
  const rate = nodalPrecessionRadS(elements.semiMajorAxisM, elements.inclinationRad, elements.eccentricity)
  return wrapTwoPi(elements.raanRad + rate * tS)
}

/** Position in the inertial frame at time t (seconds from t = 0), in metres. */
export function positionEciM(elements: OrbitalElements, tS: number): Vec3 {
  const M = meanAnomalyRad(tS, elements.timeOfPerigeeS, periodS(elements))
  const E = solveKepler(M, elements.eccentricity)
  return planeToEci(
    positionInPlaneM(elements, E),
    elements.argumentOfPerigeeRad,
    elements.inclinationRad,
    raanAtRad(elements, tS),
  )
}

/**
 * The whole ellipse as it lies at time t, as `points` positions spaced evenly
 * in eccentric anomaly. The first point is repeated at the end to close it.
 */
export function orbitPathEciM(elements: OrbitalElements, tS: number, points = 256): Vec3[] {
  const raan = raanAtRad(elements, tS)
  const path: Vec3[] = []
  for (let index = 0; index <= points; index++) {
    const E = (TWO_PI * index) / points
    path.push(
      planeToEci(positionInPlaneM(elements, E), elements.argumentOfPerigeeRad, elements.inclinationRad, raan),
    )
  }
  return path
}

export const length = (v: Vec3): number => Math.hypot(v[0], v[1], v[2])
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
