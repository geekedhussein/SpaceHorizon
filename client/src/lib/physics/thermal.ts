// Radiative equilibrium temperature. Pure functions, SI units.
//
// Reference: [SMAD] J. R. Wertz, D. F. Everett, J. J. Puschell (eds.), Space
// Mission Engineering: The New SMAD, thermal subsystem (energy balance of a
// body in sunlight, Stefan-Boltzmann law).

import { STEFAN_BOLTZMANN_W_M2_K4 } from './constants.ts'

/**
 * Temperature at which a body radiates away exactly the heat it takes in:
 *   Q_in = epsilon sigma A T^4   =>   T = (Q_in / (epsilon sigma A))^(1/4)
 * Q_in is all absorbed and internally made heat; A is the radiating area.
 */
export function equilibriumTemperatureK(
  absorbedPowerW: number,
  emissivity: number,
  radiatingAreaM2: number,
): number {
  return (absorbedPowerW / (emissivity * STEFAN_BOLTZMANN_W_M2_K4 * radiatingAreaM2)) ** 0.25
}

/**
 * Equilibrium temperature of a sphere in sunlight. It absorbs over its
 * cross-section (pi r^2) and radiates from its whole surface (4 pi r^2):
 *   T = (S alpha / (4 epsilon sigma))^(1/4)
 * alpha is solar absorptivity, epsilon is infrared emissivity.
 *
 * Approximations: the body is all at one temperature, always in sunlight, and
 * heated only by the Sun (no heat from Earth, no reflected sunlight, no heat
 * from its own electronics).
 */
export function sphereEquilibriumTemperatureK(
  solarFluxWM2: number,
  absorptivity: number,
  emissivity: number,
): number {
  return equilibriumTemperatureK(solarFluxWM2 * absorptivity * Math.PI, emissivity, 4 * Math.PI)
}

/**
 * Black-body temperature of a planet: a sphere that absorbs the sunlight it
 * does not reflect (1 - Bond albedo) and radiates perfectly.
 */
export function planetBlackBodyTemperatureK(solarFluxWM2: number, bondAlbedo: number): number {
  return sphereEquilibriumTemperatureK(solarFluxWM2, 1 - bondAlbedo, 1)
}
