// Rocket equation. Pure functions, SI units.
//
// Reference: [Curtis] H. D. Curtis, Orbital Mechanics for Engineering Students,
// rocket vehicle dynamics.

import { STANDARD_GRAVITY_M_S2 } from './constants.ts'

/** Effective exhaust velocity: v_e = Isp g0. */
export function exhaustVelocityMS(specificImpulseS: number): number {
  return specificImpulseS * STANDARD_GRAVITY_M_S2
}

/**
 * Tsiolkovsky rocket equation: delta-v = Isp g0 ln(m0 / mf), where m0 is the
 * mass before the burn and mf the mass after it.
 */
export function rocketDeltaVMS(
  specificImpulseS: number,
  initialMassKg: number,
  finalMassKg: number,
): number {
  return exhaustVelocityMS(specificImpulseS) * Math.log(initialMassKg / finalMassKg)
}

/**
 * Rocket equation solved for propellant: m_p = mf (exp(delta-v / (Isp g0)) - 1),
 * where mf is the mass left after the burn.
 */
export function propellantMassKg(
  specificImpulseS: number,
  finalMassKg: number,
  deltaVMS: number,
): number {
  return finalMassKg * Math.expm1(deltaVMS / exhaustVelocityMS(specificImpulseS))
}
