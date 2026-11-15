// Unit conversions between content files (km, degrees, days) and the physics
// module (SI base units and radians).

export const M_PER_KM = 1000
export const S_PER_MINUTE = 60
export const S_PER_HOUR = 3600
export const J_PER_WH = 3600

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

/** A power ratio expressed in decibels. */
export function toDb(ratio: number): number {
  return 10 * Math.log10(ratio)
}

/** A decibel value turned back into a power ratio. */
export function fromDb(db: number): number {
  return 10 ** (db / 10)
}
