import { describe, expect, it } from 'vitest'
import { EARTH_EQUATORIAL_RADIUS_M, SOLAR_DAY_S } from './constants.ts'
import {
  earthCentralAngleRad,
  equatorialRevisitTimeS,
  groundSampleDistanceM,
  maxPassDurationS,
  stationContactFraction,
  swathWidthM,
} from './coverage.ts'
import { slantRangeM } from './link.ts'
import { orbitalPeriodS, semiMajorAxisM } from './orbit.ts'
import { degToRad, M_PER_KM } from './units.ts'

const altitudeM = 500 * M_PER_KM
const minElevationRad = degToRad(10)

describe('Earth central angle', () => {
  it('is zero when the spacecraft must be straight overhead', () => {
    expect(earthCentralAngleRad(altitudeM, degToRad(90))).toBeCloseTo(0, 12)
  })

  it('is consistent with the slant range (law of cosines)', () => {
    const lambda = earthCentralAngleRad(altitudeM, minElevationRad)
    const r = EARTH_EQUATORIAL_RADIUS_M + altitudeM
    const range = Math.sqrt(
      EARTH_EQUATORIAL_RADIUS_M ** 2 + r ** 2 - 2 * EARTH_EQUATORIAL_RADIUS_M * r * Math.cos(lambda),
    )
    expect(range).toBeCloseTo(slantRangeM(altitudeM, minElevationRad), 3)
  })

  it('makes the longest pass a few minutes long in low orbit', () => {
    const lambda = earthCentralAngleRad(altitudeM, minElevationRad)
    const expected = (orbitalPeriodS(semiMajorAxisM(altitudeM)) * lambda) / Math.PI
    expect(maxPassDurationS(altitudeM, minElevationRad)).toBeCloseTo(expected, 9)
    expect(maxPassDurationS(altitudeM, minElevationRad) / 60).toBeGreaterThan(5)
    expect(maxPassDurationS(altitudeM, minElevationRad) / 60).toBeLessThan(12)
  })
})

describe('ground-station contact fraction', () => {
  const lambda = earthCentralAngleRad(altitudeM, minElevationRad)

  it('is lambda / pi for an equatorial orbit and an equatorial station', () => {
    const fraction = stationContactFraction({
      altitudeM,
      inclinationRad: 0,
      stationLatitudeRad: 0,
      minElevationRad,
    })
    expect(fraction).toBeCloseTo(lambda / Math.PI, 9)
  })

  it('is lambda / pi for a polar orbit and a station at the pole', () => {
    // The station sees the spacecraft on every orbit, for 2 lambda of the 2 pi.
    const fraction = stationContactFraction({
      altitudeM,
      inclinationRad: degToRad(90),
      stationLatitudeRad: degToRad(90),
      minElevationRad,
      steps: 7200,
    })
    expect(fraction).toBeCloseTo(lambda / Math.PI, 3)
  })

  it('is the same north and south of the equator', () => {
    const options = { altitudeM, inclinationRad: degToRad(51.6), minElevationRad }
    expect(stationContactFraction({ ...options, stationLatitudeRad: degToRad(-35) })).toBeCloseTo(
      stationContactFraction({ ...options, stationLatitudeRad: degToRad(35) }),
      12,
    )
  })

  it('is zero for a station the orbit never comes near', () => {
    const fraction = stationContactFraction({
      altitudeM,
      inclinationRad: degToRad(20),
      stationLatitudeRad: degToRad(78),
      minElevationRad,
    })
    expect(fraction).toBe(0)
  })

  it('favours polar stations for near-polar orbits', () => {
    const options = { altitudeM, inclinationRad: degToRad(97.4), minElevationRad }
    expect(stationContactFraction({ ...options, stationLatitudeRad: degToRad(78) })).toBeGreaterThan(
      2 * stationContactFraction({ ...options, stationLatitudeRad: degToRad(0) }),
    )
  })

  it('does not depend on the number of steps once there are enough', () => {
    const options = {
      altitudeM,
      inclinationRad: degToRad(97.4),
      stationLatitudeRad: degToRad(40),
      minElevationRad,
    }
    expect(stationContactFraction(options)).toBeCloseTo(
      stationContactFraction({ ...options, steps: 20_000 }),
      4,
    )
  })
})

describe('imaging coverage', () => {
  it('scales pixel size and strip width with altitude', () => {
    // MultiScape50: 30 m pixels and a 120 km strip from 500 km.
    expect(groundSampleDistanceM(30, 500e3, 400e3)).toBeCloseTo(24, 9)
    expect(groundSampleDistanceM(30, 500e3, 705e3)).toBeCloseTo(42.3, 9)
    expect(swathWidthM(120e3, 500e3, 786e3)).toBeCloseTo(188.64e3, 6)
  })

  it('covers the equator in about 22 days with a 120 km strip from 500 km', () => {
    // 40,075 km / 120 km = 334 orbits at 94.5 minutes each = 21.9 days.
    expect(equatorialRevisitTimeS(120e3, altitudeM) / SOLAR_DAY_S).toBeCloseTo(21.9, 1)
  })

  it('is close to Landsat 9\'s real 16-day cycle', () => {
    // Landsat 9: 705 km, 185 km strip, images all of Earth every 16 days. The
    // model gives 14.9 days; the real cycle is longer because neighbouring
    // strips overlap.
    const days = equatorialRevisitTimeS(185e3, 705 * M_PER_KM) / SOLAR_DAY_S
    expect(days).toBeLessThan(16)
    expect(days).toBeGreaterThan(16 * 0.9)
  })

  it('takes far longer with a narrow strip', () => {
    // MultiScape100: a 19.4 km strip from 500 km.
    expect(equatorialRevisitTimeS(19.4e3, altitudeM) / SOLAR_DAY_S).toBeGreaterThan(100)
  })
})
