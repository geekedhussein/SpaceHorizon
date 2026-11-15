// From game content to a moving picture: turn an orbit from /content into
// orbital elements, and work out what the scene shows at a moment in time.
// Pure functions. The 3D scene only draws what these return.

import { earthCentralAngleRad } from '../physics/coverage.ts'
import { semiMajorAxisM } from '../physics/orbit.ts'
import { degToRad, M_PER_KM } from '../physics/units.ts'
import { MIN_ELEVATION_RAD } from '../sim/parameters.ts'
import type { GroundStation, Orbit } from '../sim/types.ts'
import {
  ecefToGeographic,
  eciToEcef,
  elevationRad,
  geographicToEcefM,
  gmstRad,
  inEarthShadow,
  sunPosition,
} from './frames.ts'
import type { GroundPoint } from './frames.ts'
import { positionEciM, wrapTwoPi } from './kepler.ts'
import type { OrbitalElements, Vec3 } from './kepler.ts'

/**
 * Equator crossing time used for a Sun-synchronous orbit whose source does not
 * give one. 10:30 is Sentinel-2's (see /content/orbits.json). Display only:
 * the simulation always assumes the longest eclipse.
 */
export const DEFAULT_LOCAL_TIME_DESCENDING_NODE = '10:30'

/** "10:12" -> hours as a number. */
export function parseLocalTimeHours(text: string): number {
  const [hours, minutes] = text.split(':').map(Number)
  return hours + minutes / 60
}

/**
 * Orbital elements for a content orbit, with t = 0 at `epochMs`.
 *
 * - Sun-synchronous orbits: the plane is placed so the spacecraft crosses the
 *   equator southbound at the given local mean solar time. Local mean time at
 *   a point is 12 h + (its right ascension - the mean Sun's) / 15 degrees.
 * - Other orbits: the ascending node starts on the x axis. This is a free
 *   choice; a real one depends on the launch time.
 * - The spacecraft starts at its ascending node (also a free choice).
 */
export function elementsForOrbit(orbit: Orbit, epochMs: number): OrbitalElements {
  let raanRad = 0
  if (orbit.sun_synchronous) {
    const localHours = parseLocalTimeHours(orbit.local_time_descending_node ?? DEFAULT_LOCAL_TIME_DESCENDING_NODE)
    const descendingNode = sunPosition(epochMs).meanLongitudeRad + degToRad((localHours - 12) * 15)
    raanRad = wrapTwoPi(descendingNode + Math.PI)
  }
  return {
    semiMajorAxisM: semiMajorAxisM(orbit.altitude_km * M_PER_KM),
    eccentricity: orbit.eccentricity,
    inclinationRad: degToRad(orbit.inclination_deg),
    argumentOfPerigeeRad: 0,
    raanRad,
    timeOfPerigeeS: 0,
  }
}

export interface StationView {
  stationId: string
  /** Station position in the Earth-fixed frame. */
  positionEcefM: Vec3
  /** Height of the spacecraft above the station's horizon. */
  elevationRad: number
  /** The spacecraft is high enough for the station to use (see MIN_ELEVATION_RAD). */
  inContact: boolean
}

/** Everything the orbit view shows at one moment. */
export interface MissionGeometry {
  timeMs: number
  /** Spacecraft position, inertial frame. */
  positionEciM: Vec3
  /** The point on the ground below the spacecraft, and its height. */
  subpoint: GroundPoint
  /** Unit vector to the Sun, inertial frame. */
  sunDirectionEci: Vec3
  /** How far Earth has turned (Greenwich mean sidereal time). */
  earthRotationRad: number
  inEclipse: boolean
  stations: StationView[]
}

/** Where everything is `tS` seconds after the epoch. */
export function missionGeometry(
  elements: OrbitalElements,
  stations: GroundStation[],
  epochMs: number,
  tS: number,
): MissionGeometry {
  const timeMs = epochMs + tS * 1000
  const positionEci = positionEciM(elements, tS)
  const earthRotationRad = gmstRad(timeMs)
  const positionEcef = eciToEcef(positionEci, earthRotationRad)
  const sunDirectionEci = sunPosition(timeMs).directionEci

  return {
    timeMs,
    positionEciM: positionEci,
    subpoint: ecefToGeographic(positionEcef),
    sunDirectionEci,
    earthRotationRad,
    inEclipse: inEarthShadow(positionEci, sunDirectionEci),
    stations: stations.map((station) => {
      const positionEcefM = geographicToEcefM(degToRad(station.latitude_deg), degToRad(station.longitude_deg))
      const elevation = elevationRad(positionEcefM, positionEcef)
      return {
        stationId: station.id,
        positionEcefM,
        elevationRad: elevation,
        inContact: elevation >= MIN_ELEVATION_RAD,
      }
    }),
  }
}

/**
 * The ground track: the points the spacecraft flies over, from `startS` for
 * `durationS` seconds, as `steps` + 1 points.
 */
export function groundTrack(
  elements: OrbitalElements,
  epochMs: number,
  startS: number,
  durationS: number,
  steps: number,
): GroundPoint[] {
  const track: GroundPoint[] = []
  for (let index = 0; index <= steps; index++) {
    const tS = startS + (durationS * index) / steps
    track.push(ecefToGeographic(eciToEcef(positionEciM(elements, tS), gmstRad(epochMs + tS * 1000))))
  }
  return track
}

/**
 * How far from a station (as an angle at Earth's centre) the point below the
 * spacecraft can be while the station still sees it. This is the size of the
 * coverage cone drawn over each station, and the same angle the simulation
 * uses for contact time.
 */
export function contactConeAngleRad(orbit: Orbit): number {
  return earthCentralAngleRad(orbit.altitude_km * M_PER_KM, MIN_ELEVATION_RAD)
}
