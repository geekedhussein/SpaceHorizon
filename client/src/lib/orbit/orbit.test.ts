import { describe, expect, it } from 'vitest'
import { catalog } from '../../../tests/content.ts'
import { EARTH_EQUATORIAL_RADIUS_M, EARTH_TROPICAL_YEAR_S, SOLAR_DAY_S } from '../physics/constants.ts'
import { stationContactFraction } from '../physics/coverage.ts'
import { eclipseFraction } from '../physics/orbit.ts'
import { degToRad, radToDeg } from '../physics/units.ts'
import { MIN_ELEVATION_RAD } from '../sim/parameters.ts'
import type { Orbit } from '../sim/types.ts'
import {
  ecefToEci,
  ecefToGeographic,
  eciToEcef,
  elevationRad,
  geographicToEcefM,
  gmstRad,
  inEarthShadow,
  julianDate,
  sunPosition,
} from './frames.ts'
import {
  dot,
  length,
  meanAnomalyRad,
  orbitPathEciM,
  periodS,
  positionEciM,
  positionInPlaneM,
  raanAtRad,
  solveKepler,
  wrapTwoPi,
} from './kepler.ts'
import type { OrbitalElements, Vec3 } from './kepler.ts'
import { elementsForOrbit, missionGeometry, parseLocalTimeHours } from './mission.ts'

const orbit = (id: string): Orbit => {
  const found = catalog.orbits.find((entry) => entry.id === id)
  if (!found) throw new Error(`no orbit ${id}`)
  return found
}
const EPOCH = Date.UTC(2027, 0, 1)

/** Smallest signed difference between two angles, in degrees. */
const angleBetweenDeg = (a: number, b: number): number => radToDeg(wrapTwoPi(a - b + Math.PI) - Math.PI)

describe("Kepler's equation", () => {
  it('returns the mean anomaly for a circle', () => {
    for (const M of [0, 1, 3, 6]) expect(solveKepler(M, 0)).toBe(M)
  })

  it('solves a known eccentric case', () => {
    // M = 235.4 degrees, e = 0.4 gives E = 220.512074 degrees (the worked
    // example in Vallado, Fundamentals of Astrodynamics, Kepler's equation).
    expect(radToDeg(solveKepler(degToRad(235.4), 0.4))).toBeCloseTo(220.512074, 5)
  })

  it('satisfies M = E - e sin E across the range, even for stretched orbits', () => {
    for (const e of [0, 0.1, 0.5, 0.9, 0.99]) {
      for (let M = 0; M < 2 * Math.PI; M += 0.37) {
        const E = solveKepler(M, e)
        expect(E - e * Math.sin(E), `e=${e} M=${M}`).toBeCloseTo(M, 9)
      }
    }
  })

  it('wraps the mean anomaly to one turn', () => {
    expect(meanAnomalyRad(150, 0, 100)).toBeCloseTo(Math.PI, 12)
    expect(meanAnomalyRad(-25, 0, 100)).toBeCloseTo(1.5 * Math.PI, 12)
    expect(meanAnomalyRad(30, 30, 100)).toBe(0)
  })
})

describe('position on the orbit', () => {
  const iss = elementsForOrbit(orbit('iss-like'), EPOCH)

  it('goes round the space station orbit in about 92 minutes', () => {
    expect(periodS(iss) / 60).toBeGreaterThan(92)
    expect(periodS(iss) / 60).toBeLessThan(93)
  })

  it('stays at a constant height on a circular orbit', () => {
    for (let t = 0; t < 6000; t += 500) {
      expect(length(positionEciM(iss, t))).toBeCloseTo(EARTH_EQUATORIAL_RADIUS_M + 400e3, 3)
    }
  })

  it('starts at the ascending node and climbs north', () => {
    const start = positionEciM(iss, 0)
    expect(start[2]).toBeCloseTo(0, 3)
    expect(positionEciM(iss, 60)[2]).toBeGreaterThan(0)
  })

  it('never goes further north or south than its inclination', () => {
    let highest = 0
    for (let t = 0; t < periodS(iss); t += 10) {
      const p = positionEciM(iss, t)
      highest = Math.max(highest, Math.abs(Math.asin(p[2] / length(p))))
    }
    expect(radToDeg(highest)).toBeCloseTo(51.6, 1)
  })

  it('reaches perigee and apogee of an eccentric orbit at the right distances', () => {
    const molniyaLike: OrbitalElements = {
      semiMajorAxisM: 26_600e3,
      eccentricity: 0.74,
      inclinationRad: degToRad(63.4),
      argumentOfPerigeeRad: degToRad(270),
      raanRad: degToRad(40),
      timeOfPerigeeS: 1000,
    }
    const T = periodS(molniyaLike)
    expect(length(positionEciM(molniyaLike, 1000))).toBeCloseTo(26_600e3 * (1 - 0.74), 2)
    expect(length(positionEciM(molniyaLike, 1000 + T / 2))).toBeCloseTo(26_600e3 * (1 + 0.74), 2)
    // Perigee at 270 degrees past the node is the southernmost point.
    const perigee = positionEciM(molniyaLike, 1000)
    expect(radToDeg(Math.asin(perigee[2] / length(perigee)))).toBeCloseTo(-63.4, 6)
  })

  it('sweeps equal areas in equal times (Kepler\'s second law)', () => {
    const e = 0.6
    const elements: OrbitalElements = {
      semiMajorAxisM: 20_000e3, eccentricity: e, inclinationRad: 0.5,
      argumentOfPerigeeRad: 1, raanRad: 2, timeOfPerigeeS: 0,
    }
    // Angular momentum per unit mass, |r x v|, is constant; estimate v by a small step.
    const h = (t: number): number => {
      const a = positionEciM(elements, t)
      const b = positionEciM(elements, t + 0.01)
      const v: Vec3 = [(b[0] - a[0]) / 0.01, (b[1] - a[1]) / 0.01, (b[2] - a[2]) / 0.01]
      return length([a[1] * v[2] - a[2] * v[1], a[2] * v[0] - a[0] * v[2], a[0] * v[1] - a[1] * v[0]])
    }
    const T = periodS(elements)
    // The slow turn of the orbit plane adds about 0.1% of sideways motion far
    // from Earth, so compare to 0.5%.
    expect(h(0.45 * T) / h(0)).toBeCloseTo(1, 2)
    expect(h(0.2 * T) / h(0)).toBeCloseTo(1, 2)
  })

  it('draws a closed path that the spacecraft lies on', () => {
    const path = orbitPathEciM(iss, 0, 64)
    expect(path).toHaveLength(65)
    expect(path[64][0]).toBeCloseTo(path[0][0], 3)
    expect(positionInPlaneM(iss, 0)).toEqual([iss.semiMajorAxisM, 0, 0])
    const quarter = positionEciM(iss, periodS(iss) / 4)
    const onPath = orbitPathEciM(iss, periodS(iss) / 4, 64)[16]
    expect(length([quarter[0] - onPath[0], quarter[1] - onPath[1], quarter[2] - onPath[2]])).toBeLessThan(1)
  })
})

describe('time and the sky', () => {
  it('converts dates to Julian dates', () => {
    expect(julianDate(Date.UTC(2000, 0, 1, 12))).toBe(2_451_545)
    expect(julianDate(0)).toBe(2_440_587.5)
  })

  it('gives the sidereal time of J2000.0', () => {
    // 18.697374558 hours (US Naval Observatory).
    expect((gmstRad(Date.UTC(2000, 0, 1, 12)) / (2 * Math.PI)) * 24).toBeCloseTo(18.697374558, 9)
  })

  it('turns Earth once per sidereal day', () => {
    const start = gmstRad(EPOCH)
    expect(angleBetweenDeg(gmstRad(EPOCH + 86_164_090.5), start)).toBeCloseTo(0, 3)
    // After a solar day Earth has turned about 0.9856 degrees more than a full turn.
    expect(angleBetweenDeg(gmstRad(EPOCH + 86_400_000), start)).toBeCloseTo(0.9856, 3)
  })

  it('puts the Sun over the equator at the March 2026 equinox', () => {
    // 20 March 2026, 14:46 UTC.
    const sun = sunPosition(Date.UTC(2026, 2, 20, 14, 46))
    expect(Math.abs(radToDeg(sun.declinationRad))).toBeLessThan(0.02)
    expect(Math.abs(angleBetweenDeg(sun.eclipticLongitudeRad, 0))).toBeLessThan(0.02)
  })

  it('puts the Sun furthest north at the June 2026 solstice', () => {
    // 21 June 2026, 08:25 UTC.
    const sun = sunPosition(Date.UTC(2026, 5, 21, 8, 25))
    expect(radToDeg(sun.declinationRad)).toBeCloseTo(23.44, 2)
    expect(Math.abs(angleBetweenDeg(sun.eclipticLongitudeRad, Math.PI / 2))).toBeLessThan(0.02)
  })

  it('puts the Sun overhead near Greenwich at noon UTC', () => {
    // Sundial and clock agree to within a minute around 15 April and 1 September.
    for (const date of [Date.UTC(2026, 3, 15, 12), Date.UTC(2026, 8, 1, 12)]) {
      const below = ecefToGeographic(eciToEcef(sunPosition(date).directionEci, gmstRad(date)))
      expect(Math.abs(radToDeg(below.longitudeRad)), new Date(date).toISOString()).toBeLessThan(0.3)
    }
    // In early November the Sun runs about 16 minutes (4 degrees) ahead of the clock.
    const november = Date.UTC(2026, 10, 3, 12)
    const below = ecefToGeographic(eciToEcef(sunPosition(november).directionEci, gmstRad(november)))
    expect(radToDeg(below.longitudeRad)).toBeCloseTo(-4.1, 0)
  })

  it('returns a unit vector to the Sun', () => {
    expect(length(sunPosition(EPOCH).directionEci)).toBeCloseTo(1, 12)
  })
})

describe('ground points', () => {
  it('places latitude and longitude on the Earth-fixed axes', () => {
    const R = EARTH_EQUATORIAL_RADIUS_M
    const close = (v: Vec3, w: Vec3) => v.forEach((value, i) => expect(value).toBeCloseTo(w[i], 3))
    close(geographicToEcefM(0, 0), [R, 0, 0])
    close(geographicToEcefM(0, Math.PI / 2), [0, R, 0])
    close(geographicToEcefM(Math.PI / 2, 0), [0, 0, R])
  })

  it('round-trips through both frames', () => {
    const point = geographicToEcefM(degToRad(78.231), degToRad(15.389), 500e3)
    const back = ecefToGeographic(eciToEcef(ecefToEci(point, 1.234), 1.234))
    expect(radToDeg(back.latitudeRad)).toBeCloseTo(78.231, 9)
    expect(radToDeg(back.longitudeRad)).toBeCloseTo(15.389, 9)
    expect(back.heightM).toBeCloseTo(500e3, 3)
  })

  it('measures elevation above the horizon', () => {
    const station = geographicToEcefM(0, 0)
    expect(radToDeg(elevationRad(station, geographicToEcefM(0, 0, 500e3)))).toBeCloseTo(90, 6)
    expect(elevationRad(station, geographicToEcefM(0, Math.PI, 500e3))).toBeLessThan(0)
    // A target on the local horizontal plane is at zero elevation.
    expect(elevationRad(station, [EARTH_EQUATORIAL_RADIUS_M, 1e6, 0])).toBeCloseTo(0, 9)
  })

  it('casts a cylinder of shadow behind Earth', () => {
    const sun: Vec3 = [1, 0, 0]
    expect(inEarthShadow([-7e6, 0, 0], sun)).toBe(true)
    expect(inEarthShadow([7e6, 0, 0], sun)).toBe(false)
    expect(inEarthShadow([-7e6, 6.4e6, 0], sun)).toBe(false)
    expect(inEarthShadow([-7e6, 6.3e6, 0], sun)).toBe(true)
  })
})

describe('orbits from the game content', () => {
  /** Local mean solar time where the spacecraft crosses the equator southbound. */
  function descendingNodeLocalHours(id: string, tS: number): number {
    const elements = elementsForOrbit(orbit(id), EPOCH)
    const node = raanAtRad(elements, tS) + Math.PI
    const meanSun = sunPosition(EPOCH + tS * 1000).meanLongitudeRad
    return 12 + angleBetweenDeg(node, meanSun) / 15
  }

  it('reads a clock time', () => {
    expect(parseLocalTimeHours('10:12')).toBeCloseTo(10.2, 12)
  })

  it('crosses the equator at the published local time', () => {
    expect(descendingNodeLocalHours('landsat-705', 0)).toBeCloseTo(10.2, 6)
    expect(descendingNodeLocalHours('sentinel2-786', 0)).toBeCloseTo(10.5, 6)
  })

  it('keeps Sun-synchronous orbits at nearly the same local time for a year', () => {
    const year = EARTH_TROPICAL_YEAR_S
    // Published inclinations are rounded, so allow a drift of 40 minutes a year.
    for (const id of ['sso-500', 'landsat-705', 'sentinel2-786']) {
      const drift = descendingNodeLocalHours(id, year) - descendingNodeLocalHours(id, 0)
      expect(Math.abs(drift), id).toBeLessThan(40 / 60)
    }
    // The space station orbit is not Sun-synchronous: its plane turns west about 5 degrees a day.
    const iss = elementsForOrbit(orbit('iss-like'), EPOCH)
    expect(angleBetweenDeg(raanAtRad(iss, SOLAR_DAY_S), iss.raanRad)).toBeCloseTo(-5.0, 0)
  })

  it('is in shadow for the share of the orbit the physics module predicts', () => {
    const elements = elementsForOrbit(orbit('sso-500'), EPOCH)
    const T = periodS(elements)
    let dark = 0
    const steps = 2000
    for (let index = 0; index < steps; index++) {
      if (missionGeometry(elements, [], EPOCH, (index * T) / steps).inEclipse) dark++
    }
    // Beta: the angle between the Sun and the orbit plane.
    const raan = elements.raanRad
    const normal: Vec3 = [
      Math.sin(elements.inclinationRad) * Math.sin(raan),
      -Math.sin(elements.inclinationRad) * Math.cos(raan),
      Math.cos(elements.inclinationRad),
    ]
    const beta = Math.asin(dot(normal, sunPosition(EPOCH).directionEci))
    expect(dark / steps).toBeCloseTo(eclipseFraction(elements.semiMajorAxisM, beta), 2)
    expect(dark / steps).toBeLessThanOrEqual(eclipseFraction(elements.semiMajorAxisM, 0))
  })

  it('sees each station for the share of time the simulation assumes', () => {
    const sso = orbit('sso-500')
    const elements = elementsForOrbit(sso, EPOCH)
    const stations = catalog.groundStations.filter((entry) =>
      ['station-svalbard', 'station-wallops', 'station-singapore'].includes(entry.id),
    )
    const inContact = new Map<string, number>()
    const stepS = 20
    const days = 30
    const steps = (days * SOLAR_DAY_S) / stepS
    for (let index = 0; index < steps; index++) {
      for (const view of missionGeometry(elements, stations, EPOCH, index * stepS).stations) {
        if (view.inContact) inContact.set(view.stationId, (inContact.get(view.stationId) ?? 0) + 1)
      }
    }
    for (const station of stations) {
      const expected = stationContactFraction({
        altitudeM: sso.altitude_km * 1000,
        inclinationRad: degToRad(sso.inclination_deg),
        stationLatitudeRad: degToRad(station.latitude_deg),
        minElevationRad: MIN_ELEVATION_RAD,
      })
      const measured = (inContact.get(station.id) ?? 0) / steps
      expect(measured / expected, station.id).toBeGreaterThan(0.93)
      expect(measured / expected, station.id).toBeLessThan(1.07)
    }
  })

  it('reports the point below the spacecraft', () => {
    const elements = elementsForOrbit(orbit('sso-500'), EPOCH)
    const view = missionGeometry(elements, [], EPOCH, 0)
    expect(view.timeMs).toBe(EPOCH)
    expect(view.subpoint.heightM).toBeCloseTo(500e3, 3)
    expect(view.subpoint.latitudeRad).toBeCloseTo(0, 9)
    // Southbound crossing is at 10:30 local time, so the northbound one is at 22:30: night side.
    expect(dot(view.positionEciM, view.sunDirectionEci)).toBeLessThan(0)
  })

  it('is deterministic', () => {
    const elements = elementsForOrbit(orbit('landsat-705'), EPOCH)
    expect(missionGeometry(elements, catalog.groundStations, EPOCH, 12345)).toEqual(
      missionGeometry(elements, catalog.groundStations, EPOCH, 12345),
    )
  })
})
