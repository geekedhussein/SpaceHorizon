import { describe, expect, it } from 'vitest'
import { SOLAR_CONSTANT_W_M2, STEFAN_BOLTZMANN_W_M2_K4 } from './constants.ts'
import {
  equilibriumTemperatureK,
  planetBlackBodyTemperatureK,
  sphereEquilibriumTemperatureK,
} from './thermal.ts'

describe('equilibrium temperature', () => {
  it('matches the published black-body temperature of Mars', () => {
    // NASA Mars Fact Sheet: solar irradiance 586.2 W/m^2, Bond albedo 0.250,
    // black-body temperature 209.8 K.
    expect(planetBlackBodyTemperatureK(586.2, 0.25)).toBeCloseTo(209.8, 1)
  })

  it('is close to the published black-body temperature of Earth', () => {
    // NASA Earth Fact Sheet: 1361.0 W/m^2, Bond albedo 0.294, black-body
    // temperature 254.0 K. The sheet's own irradiance and albedo give 255.1 K,
    // so the three published figures do not agree to better than about 1 K.
    const temperatureK = planetBlackBodyTemperatureK(SOLAR_CONSTANT_W_M2, 0.294)
    expect(Math.abs(temperatureK - 254.0)).toBeLessThan(1.5)
  })

  it('inverts the Stefan-Boltzmann law', () => {
    // A 1 m^2 black body at 300 K radiates sigma x 300^4 watts.
    const powerW = STEFAN_BOLTZMANN_W_M2_K4 * 300 ** 4
    expect(equilibriumTemperatureK(powerW, 1, 1)).toBeCloseTo(300, 9)
  })

  it('runs hotter with a dark, poorly radiating surface', () => {
    const balanced = sphereEquilibriumTemperatureK(SOLAR_CONSTANT_W_M2, 0.5, 0.5)
    expect(sphereEquilibriumTemperatureK(SOLAR_CONSTANT_W_M2, 0.9, 0.3)).toBeGreaterThan(balanced)
    // Equal absorptivity and emissivity behave like a black body.
    expect(balanced).toBeCloseTo(planetBlackBodyTemperatureK(SOLAR_CONSTANT_W_M2, 0), 9)
  })
})
