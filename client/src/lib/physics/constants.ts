// Physical constants used by the physics module. Defined once, with sources.
//
// Units: the physics module works in SI base units throughout (metres, seconds,
// kilograms, watts, kelvin, hertz, radians). Every name carries its unit. Content
// files use km, degrees and days; convert at the boundary with ./units.ts.
//
// Sources (all read 2026-11-15, listed in docs/sources.md):
//   [EFS]  NASA Earth Fact Sheet, D. R. Williams, NSSDCA, updated 15 Nov 2024
//          https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html
//   [JPL]  JPL Solar System Dynamics, Astrodynamic Parameters
//          https://ssd.jpl.nasa.gov/astro_par.html
//   [NIST] NIST, CODATA 2022 recommended values
//          https://physics.nist.gov/cuu/Constants/Table/allascii.txt

/** Earth's gravitational parameter GM. [JPL] DE440: 398600.435507 km^3/s^2. */
export const EARTH_GM_M3_S2 = 3.98600435507e14

/** Earth's equatorial radius. [EFS] 6378.137 km. Altitudes are measured from this. */
export const EARTH_EQUATORIAL_RADIUS_M = 6_378_137

/** Earth's volumetric mean radius. [EFS] 6371.000 km. */
export const EARTH_MEAN_RADIUS_M = 6_371_000

/** Earth's J2 oblateness coefficient. [EFS] 1082.63 x 10^-6. */
export const EARTH_J2 = 1082.63e-6

/** Earth's sidereal rotation period. [EFS] 23.9345 hours. */
export const EARTH_SIDEREAL_DAY_S = 23.9345 * 3600

/** Earth's tropical orbit period (one cycle of seasons). [EFS] 365.242 days. */
export const EARTH_TROPICAL_YEAR_S = 365.242 * 86_400

/** Earth's obliquity to its orbit. [EFS] 23.44 degrees. */
export const EARTH_OBLIQUITY_DEG = 23.44

/** Mean solar day. [JPL] 86400 s. */
export const SOLAR_DAY_S = 86_400

/** Solar irradiance at 1 au (the "solar constant"). [EFS] 1361.0 W/m^2. */
export const SOLAR_CONSTANT_W_M2 = 1361.0

/** Astronomical unit. [JPL] IAU 2012 Resolution B1: 149597870700 m (exact). */
export const ASTRONOMICAL_UNIT_M = 149_597_870_700

/** Speed of light in vacuum. [NIST] exact. */
export const SPEED_OF_LIGHT_M_S = 299_792_458

/** Boltzmann constant. [NIST] exact. */
export const BOLTZMANN_J_K = 1.380649e-23

/** Stefan-Boltzmann constant. [NIST] exact, truncated here to 10 digits. */
export const STEFAN_BOLTZMANN_W_M2_K4 = 5.670374419e-8

/** Standard acceleration of gravity, used to define specific impulse. [NIST] exact. */
export const STANDARD_GRAVITY_M_S2 = 9.80665
