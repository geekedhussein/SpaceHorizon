import { describe, expect, it } from 'vitest'
import { EARTH_TROPICAL_YEAR_S, SOLAR_DAY_S } from './constants.ts'
import { atmosphericDensityKgM3, orbitDecay, periodDecayRate } from './drag.ts'
import { M_PER_KM } from './units.ts'

// The worked example printed in the IPS paper: 100 kg, effective area 1 m^2,
// starting at 300 km, F10.7 = 70, Ap = 0.
const quietSun = { f107Sfu: 70, ap: 0 }
const example = { massKg: 100, effectiveAreaM2: 1, weather: quietSun }

describe('atmospheric density model', () => {
  it('follows the paper\'s equations', () => {
    // At 300 km with F10.7 = 70 and Ap = 0: T = 900 K, m = 25.8,
    // H = 34.88 km, rho = 6e-10 exp(-125 / 34.88) = 1.667e-11 kg/m^3.
    expect(atmosphericDensityKgM3(300 * M_PER_KM, quietSun)).toBeCloseTo(1.667e-11, 13)
  })

  it('thins with altitude and thickens with solar activity', () => {
    expect(atmosphericDensityKgM3(400 * M_PER_KM, quietSun)).toBeLessThan(
      atmosphericDensityKgM3(300 * M_PER_KM, quietSun),
    )
    expect(atmosphericDensityKgM3(400 * M_PER_KM, { f107Sfu: 200, ap: 15 })).toBeGreaterThan(
      atmosphericDensityKgM3(400 * M_PER_KM, quietSun),
    )
  })

  it('refuses altitudes far outside the model', () => {
    expect(() => atmosphericDensityKgM3(1500 * M_PER_KM, quietSun)).toThrow(RangeError)
  })
})

describe('orbit decay', () => {
  it('is faster for a light spacecraft with a large area', () => {
    expect(periodDecayRate(6.7e6, 1e-11, 2, 100)).toBeCloseTo(
      2 * periodDecayRate(6.7e6, 1e-11, 1, 100),
      15,
    )
    expect(periodDecayRate(6.7e6, 1e-11, 1, 50)).toBeCloseTo(
      2 * periodDecayRate(6.7e6, 1e-11, 1, 100),
      15,
    )
  })

  it('reproduces the paper\'s worked example: re-entry about 46 days from 300 km', () => {
    // The paper prints 45.7 days. Its program takes the cube root as "^ .33333",
    // which drops the orbit by about 1 km on the first step. Re-running its
    // listing gives 45.7 days as printed, and 47.1 days with an exact cube
    // root. We use the exact root, so we expect 47.1: 3% from the printed
    // figure, inside the 10% the paper claims for any decay prediction.
    const decay = orbitDecay({ ...example, altitudeM: 300 * M_PER_KM })
    expect(decay.lifetimeS).not.toBeNull()
    expect(decay.lifetimeS! / SOLAR_DAY_S).toBeCloseTo(47.1, 1)
    expect(Math.abs(decay.lifetimeS! / SOLAR_DAY_S - 45.7)).toBeLessThan(0.1 * 45.7)
    expect(decay.extrapolated).toBe(false)
    expect(decay.finalAltitudeM).toBeLessThan(180 * M_PER_KM)
  })

  it('reproduces intermediate rows of the paper\'s table', () => {
    // The table reaches 289.9 km after 10.5 days and 249.9 km after 35.4 days,
    // with re-entry printed at 45.7 days. After its first step the paper's
    // program and ours agree, so the remaining times match closely.
    const from290 = orbitDecay({ ...example, altitudeM: 289.9 * M_PER_KM })
    const from250 = orbitDecay({ ...example, altitudeM: 249.9 * M_PER_KM })
    expect(Math.abs(from290.lifetimeS! / SOLAR_DAY_S - (45.7 - 10.5))).toBeLessThan(1)
    expect(Math.abs(from250.lifetimeS! / SOLAR_DAY_S - (45.7 - 35.4))).toBeLessThan(0.5)
  })

  it('reports no re-entry when the orbit outlasts the time limit', () => {
    const decay = orbitDecay({
      massKg: 4,
      effectiveAreaM2: 0.06,
      weather: quietSun,
      altitudeM: 786 * M_PER_KM,
      stepS: 5 * SOLAR_DAY_S,
      maxDurationS: 5 * EARTH_TROPICAL_YEAR_S,
    })
    expect(decay.lifetimeS).toBeNull()
    expect(decay.extrapolated).toBe(true)
    expect(decay.finalAltitudeM).toBeLessThan(786 * M_PER_KM)
    expect(decay.finalAltitudeM).toBeGreaterThan(700 * M_PER_KM)
  })

  it('gives the same answer every time', () => {
    const options = { ...example, altitudeM: 350 * M_PER_KM }
    expect(orbitDecay(options)).toEqual(orbitDecay(options))
  })
})
