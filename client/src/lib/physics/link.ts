// Radio link budget. Pure functions, SI units; gains and losses in decibels.
//
// Reference: [SMAD] J. R. Wertz, D. F. Everett, J. J. Puschell (eds.), Space
// Mission Engineering: The New SMAD, communications link design. The link
// equation there is
//   Eb/N0 = P L_l G_t L_s L_a G_r / (k T_s R)
// which is split below into EIRP, path loss, C/N0 and data rate.

import { BOLTZMANN_J_K, EARTH_EQUATORIAL_RADIUS_M, SPEED_OF_LIGHT_M_S } from './constants.ts'
import { fromDb, toDb } from './units.ts'

/** Wavelength: lambda = c / f. */
export function wavelengthM(frequencyHz: number): number {
  return SPEED_OF_LIGHT_M_S / frequencyHz
}

/**
 * Distance from a ground station to a spacecraft seen at a given elevation
 * above the horizon, for a circular orbit over a spherical Earth:
 *   d = sqrt(r^2 - R_E^2 cos^2(el)) - R_E sin(el),   r = R_E + h
 * From the triangle Earth centre - station - spacecraft.
 */
export function slantRangeM(altitudeM: number, elevationRad: number): number {
  const r = EARTH_EQUATORIAL_RADIUS_M + altitudeM
  return (
    Math.sqrt(r ** 2 - (EARTH_EQUATORIAL_RADIUS_M * Math.cos(elevationRad)) ** 2) -
    EARTH_EQUATORIAL_RADIUS_M * Math.sin(elevationRad)
  )
}

/**
 * Free-space path loss: L_s = (4 pi d / lambda)^2, returned as a positive
 * number of decibels. [SMAD].
 */
export function freeSpacePathLossDb(distanceM: number, frequencyHz: number): number {
  return 2 * toDb((4 * Math.PI * distanceM) / wavelengthM(frequencyHz))
}

/**
 * Gain of a dish antenna: G = eta (pi D / lambda)^2, in dBi. eta is the
 * aperture efficiency. [SMAD].
 */
export function dishAntennaGainDb(
  diameterM: number,
  frequencyHz: number,
  apertureEfficiency: number,
): number {
  return toDb(apertureEfficiency * ((Math.PI * diameterM) / wavelengthM(frequencyHz)) ** 2)
}

/**
 * Effective isotropic radiated power: transmitter power times antenna gain,
 * less the loss in the cable between them. In dBW.
 */
export function eirpDbw(txPowerW: number, txAntennaGainDb: number, lineLossDb = 0): number {
  return toDb(txPowerW) + txAntennaGainDb - lineLossDb
}

/**
 * Received signal strength relative to noise in 1 Hz of bandwidth:
 *   C/N0 = EIRP - L_s - L_other + G/T - 10 log10(k)
 * G/T is the receiving station's gain-to-noise-temperature ratio in dB/K.
 * Result in dB-Hz. [SMAD].
 */
export function carrierToNoiseDensityDbHz(options: {
  eirpDbw: number
  pathLossDb: number
  receiverGOverTDbK: number
  otherLossesDb?: number
}): number {
  const { eirpDbw, pathLossDb, receiverGOverTDbK, otherLossesDb = 0 } = options
  return eirpDbw - pathLossDb - otherLossesDb + receiverGOverTDbK - toDb(BOLTZMANN_J_K)
}

/**
 * Highest data rate the link supports:
 *   R = (C/N0) / (Eb/N0 required x margin)
 * Eb/N0 required depends on the modulation and coding; the margin is a safety
 * factor. Result in bits per second. [SMAD].
 */
export function achievableDataRateBps(options: {
  carrierToNoiseDensityDbHz: number
  requiredEbN0Db: number
  marginDb?: number
}): number {
  const { carrierToNoiseDensityDbHz, requiredEbN0Db, marginDb = 0 } = options
  return fromDb(carrierToNoiseDensityDbHz - requiredEbN0Db - marginDb)
}

/** Link margin at a chosen data rate: (C/N0) - 10 log10(R) - Eb/N0 required, in dB. */
export function linkMarginDb(options: {
  carrierToNoiseDensityDbHz: number
  dataRateBps: number
  requiredEbN0Db: number
}): number {
  return options.carrierToNoiseDensityDbHz - toDb(options.dataRateBps) - options.requiredEbN0Db
}
