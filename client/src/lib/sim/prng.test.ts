import { describe, expect, it } from 'vitest'
import { mulberry32 } from './prng.ts'

function take(seed: number, count: number): number[] {
  const random = mulberry32(seed)
  return Array.from({ length: count }, () => random())
}

describe('mulberry32', () => {
  it('gives the same sequence for the same seed', () => {
    expect(take(12345, 50)).toEqual(take(12345, 50))
  })

  it('gives different sequences for different seeds', () => {
    expect(take(1, 10)).not.toEqual(take(2, 10))
  })

  it('stays in [0, 1) and is spread evenly', () => {
    const values = take(2026, 20_000)
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...values)).toBeLessThan(1)
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    expect(mean).toBeCloseTo(0.5, 2)
    const lowTenth = values.filter((value) => value < 0.1).length / values.length
    expect(lowTenth).toBeCloseTo(0.1, 2)
  })

  it('treats the seed as a 32-bit integer', () => {
    expect(take(7, 5)).toEqual(take(7 + 2 ** 32, 5))
  })
})
