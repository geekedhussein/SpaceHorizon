import { describe, expect, it } from 'vitest'
import { ASTRONOMICAL_UNIT_M, SOLAR_CONSTANT_W_M2 } from './constants.ts'
import {
  depthOfDischarge,
  orbitAveragePowerW,
  requiredBatteryCapacityWh,
  requiredSolarArrayPowerW,
  solarArrayPeakPowerW,
  solarArrayPowerW,
  solarFluxWM2,
} from './power.ts'
import { degToRad } from './units.ts'

describe('solar flux', () => {
  it('is the solar constant at Earth', () => {
    expect(solarFluxWM2()).toBe(SOLAR_CONSTANT_W_M2)
  })

  it('matches the published sunlight at Mars', () => {
    // NASA Mars Fact Sheet: semimajor axis 1.52366231 au, solar irradiance
    // 586.2 W/m^2.
    expect(solarFluxWM2(1.52366231 * ASTRONOMICAL_UNIT_M)).toBeCloseTo(586.2, 0)
  })
})

describe('solar array power', () => {
  it('is flux times area times efficiency when new and facing the Sun', () => {
    expect(solarArrayPeakPowerW(1361, 0.06, 0.3)).toBeCloseTo(24.498, 3)
  })

  it('falls with the cosine of the Sun angle and never goes negative', () => {
    expect(solarArrayPowerW({ peakPowerW: 10, incidenceRad: degToRad(60) })).toBeCloseTo(5, 9)
    expect(solarArrayPowerW({ peakPowerW: 10, incidenceRad: degToRad(120) })).toBe(0)
  })

  it('fades a little each year', () => {
    const power = solarArrayPowerW({ peakPowerW: 10, degradationPerYear: 0.02, ageYears: 2 })
    expect(power).toBeCloseTo(10 * 0.98 * 0.98, 9)
  })

  it('makes less power further from the Sun', () => {
    const atMars = solarArrayPowerW({
      peakPowerW: 10,
      distanceFromSunM: 1.52366231 * ASTRONOMICAL_UNIT_M,
    })
    expect(atMars).toBeCloseTo(10 / 1.52366231 ** 2, 9)
  })

  it('averages to zero output during eclipse', () => {
    expect(orbitAveragePowerW(10, 0.39)).toBeCloseTo(6.1, 9)
  })
})

describe('sizing', () => {
  it('sizes the array for the daylight load plus recharging', () => {
    // Hand calculation: (5 W x 36 min / 0.5 + 10 W x 56 min / 1) / 56 min
    // = (360 + 560) / 56 = 16.43 W.
    const power = requiredSolarArrayPowerW({
      daylightLoadW: 10,
      eclipseLoadW: 5,
      daylightS: 56 * 60,
      eclipseS: 36 * 60,
      daylightPathEfficiency: 1,
      eclipsePathEfficiency: 0.5,
    })
    expect(power).toBeCloseTo(920 / 56, 9)
  })

  it('sizes the battery for the eclipse', () => {
    // 10 W for 36 minutes is 6 Wh; using only 30% of the battery needs 20 Wh.
    const capacityWh = requiredBatteryCapacityWh({
      eclipseLoadW: 10,
      eclipseS: 36 * 60,
      depthOfDischarge: 0.3,
    })
    expect(capacityWh).toBeCloseTo(20, 9)
    expect(depthOfDischarge({ eclipseLoadW: 10, eclipseS: 36 * 60, capacityWh })).toBeCloseTo(
      0.3,
      9,
    )
  })

  it('shows a battery that is too small as more than fully drained', () => {
    expect(depthOfDischarge({ eclipseLoadW: 10, eclipseS: 3600, capacityWh: 5 })).toBe(2)
  })
})
