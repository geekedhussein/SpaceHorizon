import { describe, expect, it } from 'vitest'
import { STANDARD_GRAVITY_M_S2 } from './constants.ts'
import { exhaustVelocityMS, propellantMassKg, rocketDeltaVMS } from './propulsion.ts'

describe('rocket equation', () => {
  it('gives delta-v equal to the exhaust velocity when the mass ratio is e', () => {
    expect(rocketDeltaVMS(300, Math.E, 1)).toBeCloseTo(300 * STANDARD_GRAVITY_M_S2, 9)
    expect(exhaustVelocityMS(300)).toBeCloseTo(2941.995, 3)
  })

  it('gives no delta-v without propellant', () => {
    expect(rocketDeltaVMS(2000, 4, 4)).toBe(0)
    expect(propellantMassKg(2000, 4, 0)).toBe(0)
  })

  it('round-trips between delta-v and propellant mass', () => {
    const dryMassKg = 3.78
    const propellantKg = 0.22
    const deltaVMS = rocketDeltaVMS(2000, dryMassKg + propellantKg, dryMassKg)
    expect(propellantMassKg(2000, dryMassKg, deltaVMS)).toBeCloseTo(propellantKg, 12)
  })

  it('needs less propellant with a higher specific impulse', () => {
    expect(propellantMassKg(2000, 10, 100)).toBeLessThan(propellantMassKg(220, 10, 100))
  })
})
