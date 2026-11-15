import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EARTH_EQUATORIAL_RADIUS_M, EARTH_SIDEREAL_DAY_S, SOLAR_DAY_S } from './constants.ts'
import {
  circularSpeedMS,
  eclipseDurationS,
  eclipseFraction,
  groundTrackSpeedMS,
  hohmannTransfer,
  meanMotionRadS,
  nodalPrecessionRadS,
  orbitalPeriodS,
  orbitsPerDay,
  semiMajorAxisFromPeriodM,
  semiMajorAxisM,
  sunSynchronousInclinationRad,
  visVivaSpeedMS,
} from './orbit.ts'
import { degToRad, M_PER_KM, radToDeg, S_PER_MINUTE } from './units.ts'

interface OrbitEntry {
  id: string
  altitude_km: number
  inclination_deg: number
  sun_synchronous: boolean
}

const orbits = JSON.parse(
  readFileSync(new URL('../../../../content/orbits.json', import.meta.url), 'utf8'),
) as OrbitEntry[]

describe('orbital period (Kepler\'s third law)', () => {
  it('gives the space station about 92 minutes per orbit', () => {
    // NASA: the station flies at 370 to 460 km and circles Earth about every
    // 90 minutes (16 orbits a day). CLAUDE.md asks for "about 92 minutes".
    const periodMin = orbitalPeriodS(semiMajorAxisM(400 * M_PER_KM)) / S_PER_MINUTE
    expect(periodMin).toBeGreaterThan(92)
    expect(periodMin).toBeLessThan(93)
  })

  it('puts geostationary orbit at about 35,786 km', () => {
    // An orbit whose period is one sidereal day.
    const altitudeKm =
      (semiMajorAxisFromPeriodM(EARTH_SIDEREAL_DAY_S) - EARTH_EQUATORIAL_RADIUS_M) / M_PER_KM
    expect(Math.abs(altitudeKm - 35_786)).toBeLessThan(1)
  })

  it('matches the 90.5 minutes at 300 km printed in the IPS decay paper', () => {
    const periodMin = orbitalPeriodS(semiMajorAxisM(300 * M_PER_KM)) / S_PER_MINUTE
    expect(periodMin).toBeCloseTo(90.5, 1)
  })

  it('inverts cleanly', () => {
    const a = semiMajorAxisM(705 * M_PER_KM)
    expect(semiMajorAxisFromPeriodM(orbitalPeriodS(a))).toBeCloseTo(a, 3)
    expect(meanMotionRadS(a) * orbitalPeriodS(a)).toBeCloseTo(2 * Math.PI, 12)
    expect(orbitsPerDay(a)).toBeCloseTo(SOLAR_DAY_S / orbitalPeriodS(a), 12)
  })
})

describe('orbital speed (vis-viva)', () => {
  it('reproduces the speeds in Wikipedia\'s Hohmann example', () => {
    // https://en.wikipedia.org/wiki/Hohmann_transfer_orbit : r1 = 6,678 km,
    // r2 = 42,164 km; circular speeds 7.73 and 3.07 km/s; on the transfer
    // ellipse 10.15 km/s at perigee and 1.61 km/s at apogee.
    const r1 = 6_678e3
    const r2 = 42_164e3
    const aTransfer = (r1 + r2) / 2
    expect(circularSpeedMS(r1) / 1000).toBeCloseTo(7.73, 2)
    expect(circularSpeedMS(r2) / 1000).toBeCloseTo(3.07, 2)
    expect(visVivaSpeedMS(r1, aTransfer) / 1000).toBeCloseTo(10.15, 2)
    expect(visVivaSpeedMS(r2, aTransfer) / 1000).toBeCloseTo(1.61, 2)
  })

  it('gives a slower ground track than orbital speed', () => {
    // 7.06 km/s at 500 km is the figure used to derive instrument data rates.
    expect(groundTrackSpeedMS(500 * M_PER_KM) / 1000).toBeCloseTo(7.06, 2)
  })
})

describe('Hohmann transfer', () => {
  it('reproduces Wikipedia\'s low orbit to geostationary example', () => {
    // Same example: burns of 2.42 and 1.46 km/s, 3.88 km/s together.
    const transfer = hohmannTransfer(6_678e3, 42_164e3)
    expect(transfer.deltaV1MS / 1000).toBeCloseTo(2.42, 1)
    expect(transfer.deltaV2MS / 1000).toBeCloseTo(1.46, 1)
    expect(transfer.totalDeltaVMS / 1000).toBeCloseTo(3.88, 1)
  })

  it('costs the same going down as going up, and nothing for no change', () => {
    const up = hohmannTransfer(6_778e3, 7_078e3)
    const down = hohmannTransfer(7_078e3, 6_778e3)
    expect(down.totalDeltaVMS).toBeCloseTo(up.totalDeltaVMS, 9)
    expect(hohmannTransfer(7_000e3, 7_000e3).totalDeltaVMS).toBe(0)
  })

  it('takes half the period of the transfer ellipse', () => {
    const transfer = hohmannTransfer(6_778e3, 7_078e3)
    expect(transfer.transferTimeS).toBeCloseTo(orbitalPeriodS((6_778e3 + 7_078e3) / 2) / 2, 9)
  })
})

describe('J2 nodal precession', () => {
  it('drifts west for prograde orbits, east for retrograde, not at all for polar', () => {
    const a = semiMajorAxisM(500 * M_PER_KM)
    expect(nodalPrecessionRadS(a, degToRad(51.6))).toBeLessThan(0)
    expect(nodalPrecessionRadS(a, degToRad(97.4))).toBeGreaterThan(0)
    expect(nodalPrecessionRadS(a, degToRad(90))).toBeCloseTo(0, 15)
  })

  it('turns a sun-synchronous orbit once a year', () => {
    const a = semiMajorAxisM(705 * M_PER_KM)
    const inclinationRad = sunSynchronousInclinationRad(a)
    expect(inclinationRad).not.toBeNull()
    const degPerDay = radToDeg(nodalPrecessionRadS(a, inclinationRad!)) * SOLAR_DAY_S
    expect(degPerDay).toBeCloseTo(360 / 365.242, 6)
  })

  it('matches the published inclinations of Landsat 9 and Sentinel-2', () => {
    // Landsat 9: 705 km, 98.2 degrees. Sentinel-2: 786 km, 98.62 degrees.
    // The first-order J2 formula is within 0.1 degree of both.
    const landsat = radToDeg(sunSynchronousInclinationRad(semiMajorAxisM(705 * M_PER_KM))!)
    const sentinel = radToDeg(sunSynchronousInclinationRad(semiMajorAxisM(786 * M_PER_KM))!)
    expect(Math.abs(landsat - 98.2)).toBeLessThan(0.1)
    expect(Math.abs(sentinel - 98.62)).toBeLessThan(0.1)
  })

  it('agrees with every sun-synchronous orbit in /content', () => {
    const sunSynchronous = orbits.filter((orbit) => orbit.sun_synchronous)
    expect(sunSynchronous.length).toBeGreaterThan(0)
    for (const orbit of sunSynchronous) {
      const model = radToDeg(
        sunSynchronousInclinationRad(semiMajorAxisM(orbit.altitude_km * M_PER_KM))!,
      )
      expect(Math.abs(model - orbit.inclination_deg), orbit.id).toBeLessThan(0.1)
    }
  })

  it('reports that very high orbits cannot be sun-synchronous', () => {
    expect(sunSynchronousInclinationRad(semiMajorAxisM(10_000 * M_PER_KM))).toBeNull()
  })
})

describe('eclipse', () => {
  const a400 = semiMajorAxisM(400 * M_PER_KM)

  it('is about 36 minutes at 400 km when the Sun is in the orbit plane', () => {
    // Hand calculation: cos(theta_s) = sqrt(1 - (6378.137 / 6778.137)^2) = 0.3384,
    // theta_s = 70.22 degrees, fraction = 70.22 / 180 = 0.390.
    expect(eclipseFraction(a400)).toBeCloseTo(0.39, 2)
    expect(eclipseDurationS(a400) / S_PER_MINUTE).toBeCloseTo(36.1, 0)
  })

  it('shrinks as the Sun moves out of the orbit plane and then vanishes', () => {
    // No eclipse once beta exceeds asin(R_E / r) = 70.22 degrees at 400 km.
    expect(eclipseFraction(a400, degToRad(40))).toBeLessThan(eclipseFraction(a400))
    expect(eclipseFraction(a400, degToRad(69))).toBeGreaterThan(0)
    expect(eclipseFraction(a400, degToRad(71))).toBe(0)
    expect(eclipseFraction(a400, degToRad(-71))).toBe(0)
    expect(eclipseFraction(a400, degToRad(90))).toBe(0)
  })

  it('is a smaller share of the orbit higher up', () => {
    expect(eclipseFraction(semiMajorAxisM(786 * M_PER_KM))).toBeLessThan(eclipseFraction(a400))
  })
})
