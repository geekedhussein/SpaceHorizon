// Solar power and battery sizing. Pure functions, SI units and radians.
//
// Reference: [SMAD] J. R. Wertz, D. F. Everett, J. J. Puschell (eds.), Space
// Mission Engineering: The New SMAD, electrical power subsystem.

import { ASTRONOMICAL_UNIT_M, SOLAR_CONSTANT_W_M2 } from './constants.ts'
import { J_PER_WH } from './units.ts'

/** Sunlight power per square metre at a distance from the Sun: S = S0 (1 au / d)^2. */
export function solarFluxWM2(distanceFromSunM = ASTRONOMICAL_UNIT_M): number {
  return SOLAR_CONSTANT_W_M2 * (ASTRONOMICAL_UNIT_M / distanceFromSunM) ** 2
}

/**
 * Power of a new solar array facing the Sun: P = S A eta, with A the cell area
 * and eta the cell efficiency. [SMAD].
 */
export function solarArrayPeakPowerW(
  solarFluxWM2: number,
  cellAreaM2: number,
  cellEfficiency: number,
): number {
  return solarFluxWM2 * cellAreaM2 * cellEfficiency
}

/**
 * Power of a solar array in sunlight, given its power when new and facing the
 * Sun at 1 au:
 *   P = P_peak (S / S0) cos(theta) (1 - d)^years
 * theta is the angle between the Sun direction and the panel normal; d is the
 * fraction of output lost each year. A panel facing away makes nothing. [SMAD],
 * cosine loss and life degradation.
 */
export function solarArrayPowerW(options: {
  peakPowerW: number
  incidenceRad?: number
  degradationPerYear?: number
  ageYears?: number
  distanceFromSunM?: number
}): number {
  const {
    peakPowerW,
    incidenceRad = 0,
    degradationPerYear = 0,
    ageYears = 0,
    distanceFromSunM = ASTRONOMICAL_UNIT_M,
  } = options
  const cosine = Math.max(0, Math.cos(incidenceRad))
  const life = (1 - degradationPerYear) ** ageYears
  return peakPowerW * (solarFluxWM2(distanceFromSunM) / SOLAR_CONSTANT_W_M2) * cosine * life
}

/** Generation averaged over a whole orbit: the array makes nothing in eclipse. */
export function orbitAveragePowerW(sunlitPowerW: number, eclipseFraction: number): number {
  return sunlitPowerW * (1 - eclipseFraction)
}

/**
 * Array power needed in sunlight to run the daylight load and also recharge
 * the battery for the eclipse:
 *   P_sa = (P_e T_e / X_e + P_d T_d / X_d) / T_d
 * X_e and X_d are the efficiencies of the paths array -> battery -> load and
 * array -> load. [SMAD], solar array sizing.
 */
export function requiredSolarArrayPowerW(options: {
  daylightLoadW: number
  eclipseLoadW: number
  daylightS: number
  eclipseS: number
  daylightPathEfficiency: number
  eclipsePathEfficiency: number
}): number {
  const { daylightLoadW, eclipseLoadW, daylightS, eclipseS } = options
  return (
    ((eclipseLoadW * eclipseS) / options.eclipsePathEfficiency +
      (daylightLoadW * daylightS) / options.daylightPathEfficiency) /
    daylightS
  )
}

/**
 * Battery capacity needed to carry a load through eclipse:
 *   C = P_e T_e / (DoD eta)
 * DoD is the allowed depth of discharge and eta the battery-to-load
 * efficiency. Result in watt-hours. [SMAD], battery sizing.
 */
export function requiredBatteryCapacityWh(options: {
  eclipseLoadW: number
  eclipseS: number
  depthOfDischarge: number
  dischargeEfficiency?: number
}): number {
  const { eclipseLoadW, eclipseS, depthOfDischarge, dischargeEfficiency = 1 } = options
  return (eclipseLoadW * eclipseS) / J_PER_WH / (depthOfDischarge * dischargeEfficiency)
}

/**
 * The same relation solved for depth of discharge: the fraction of a battery's
 * capacity used in one eclipse. Above 1 means the battery runs flat.
 */
export function depthOfDischarge(options: {
  eclipseLoadW: number
  eclipseS: number
  capacityWh: number
  dischargeEfficiency?: number
}): number {
  const { eclipseLoadW, eclipseS, capacityWh, dischargeEfficiency = 1 } = options
  return (eclipseLoadW * eclipseS) / J_PER_WH / (capacityWh * dischargeEfficiency)
}
