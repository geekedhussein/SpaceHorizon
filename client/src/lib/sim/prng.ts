// Seeded random numbers for the simulation. Never use Math.random() in /sim:
// every player in a room must get the same mission from the same seed.

/**
 * mulberry32, a small 32-bit generator by Tommy Ettinger (2017), released to
 * the public domain. Returns a function that gives the next number in [0, 1).
 * Source: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 * JavaScript form as listed at
 * https://github.com/bryc/code/blob/master/jshash/PRNGs.md (public domain).
 */
export function mulberry32(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
