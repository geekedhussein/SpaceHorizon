// Numbers the simulation needs that are not in /content and are not constants
// of nature. Two kinds, kept apart:
//
//   1. Engineering parameters, each with its source.
//   2. Game-design settings (difficulty margins, score weights). These are
//      tuning values, not real-world data.
//
// All of them are listed in docs/model-assumptions.md.

import { EARTH_MEAN_RADIUS_M } from '../physics/constants.ts'
import type { SpaceWeather } from '../physics/drag.ts'
import { degToRad, M_PER_KM } from '../physics/units.ts'
import type { Difficulty } from './types.ts'

// ------------------------------------------------ engineering parameters ----

/**
 * Lowest elevation above the horizon at which a station is used. The Near
 * Earth Network Users' Guide (453-NENUG Rev 4, section 17.5) says the network
 * does not guarantee X-band data quality below 10 degrees.
 */
export const MIN_ELEVATION_RAD = degToRad(10)

/**
 * Signal-to-noise per bit the receiver needs, in dB. Uncoded BPSK or QPSK at a
 * bit error rate of 1e-5: BER = (1/2) erfc(sqrt(Eb/N0)) gives 9.59 dB
 * (formula: https://en.wikipedia.org/wiki/Phase-shift_keying). No
 * error-correcting code is assumed, which is conservative. A unit test checks
 * the value against the formula.
 */
export const REQUIRED_EB_N0_DB = 9.6

/**
 * Fraction of solar array output lost each year. Flight data from eleven
 * geostationary satellites: gallium-arsenide cells lost 0.44% to 1.03% a year
 * (Lohmeyer et al., Int. J. Space Science and Engineering 5(1), 2018,
 * DOI 10.1504/IJSPACESE.2018.090549). The top of the range is used.
 * Approximation: geostationary data applied to low Earth orbit.
 */
export const SOLAR_ARRAY_FADE_PER_YEAR = 0.0103

/**
 * Deepest routine battery discharge. Low-Earth-orbit batteries cycle about
 * 5,500 times a year at 10% to 40% depth (Knap, Vestergaard and Stroe,
 * Energies 13, 4097, 2020, Table 6). The top of the range is used.
 */
export const ALLOWED_DEPTH_OF_DISCHARGE = 0.4

/**
 * Fraction of the energy put into the battery that comes back out. Lithium-ion
 * efficiency is 75% to 90% (NASA Small Spacecraft Technology State of the Art
 * report 2022, power chapter, Table 3-6). The top of the range is used.
 */
export const BATTERY_ROUND_TRIP_EFFICIENCY = 0.9

/**
 * Space weather for the drag model, held constant for the whole mission:
 * long-run averages of the daily values in the GFZ Potsdam index file
 * (Matzka et al. 2021, https://doi.org/10.1029/2020SW002641). Mean observed
 * F10.7 for 1947-2025 is 124.9 sfu; mean Ap for 1932-2025 is 13.3.
 */
export const SPACE_WEATHER: SpaceWeather = { f107Sfu: 125, ap: 13 }

/** Drag coefficient suggested by the IPS orbital decay paper (see drag.ts). */
export const DRAG_COEFFICIENT = 2

/** Earth's land area, 148.94 million km2 (see docs/sources.md). */
export const EARTH_LAND_AREA_M2 = 148.94e6 * M_PER_KM ** 2

/** Share of Earth's surface that is land: land area / (4 pi R^2), about 0.29. */
export const LAND_FRACTION = EARTH_LAND_AREA_M2 / (4 * Math.PI * EARTH_MEAN_RADIUS_M ** 2)

/** The altitude instrument makers quote their figures for (see /content). */
export const INSTRUMENT_REFERENCE_ALTITUDE_M = 500 * M_PER_KM

/** Decimal gigabytes: 1 GB = 1e9 bytes = 8e9 bits. */
export const BITS_PER_GB = 8e9

/** Mean Julian year, used to turn planned years into whole simulation days. */
export const DAYS_PER_YEAR = 365.25

// --------------------------------------------------- game-design settings ---

export interface DifficultySettings {
  /** Spare launch capacity required: mass x (1 + margin) must fit. */
  massMargin: number
  /** Spare solar power required above the calculated need. */
  powerMargin: number
  /** Multiplies every random event's chance. 0 turns events off. */
  eventFactor: number
}

/** Game-design values. The physics is the same at every level. */
export const DIFFICULTY_SETTINGS: Record<Difficulty, DifficultySettings> = {
  concept: { massMargin: 0, powerMargin: 0, eventFactor: 0 },
  'trade-study': { massMargin: 0.1, powerMargin: 0.1, eventFactor: 1 },
  'point-design': { massMargin: 0.2, powerMargin: 0.2, eventFactor: 2 },
}

/** Spare signal strength kept in every link budget, in dB. Game-design value. */
export const LINK_MARGIN_DB = 3

/** Points for each part of the score. Game-design values; each set sums to 100. */
export const SCORE_WEIGHTS = {
  solo: { requirements: 55, survival: 25, efficiency: 20, collaboration: 0 },
  team: { requirements: 50, survival: 20, efficiency: 20, collaboration: 10 },
} as const

/**
 * "Sensible margins, not maximal ones": a spare fraction up to `full` earns
 * full marks; beyond that the marks fall in a straight line to zero at `zero`.
 * Game-design values.
 */
export const SENSIBLE_MARGIN = { full: 0.5, zero: 2 } as const
