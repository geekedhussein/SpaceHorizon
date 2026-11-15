import { describe, expect, it } from 'vitest'
import { fromDb } from '../physics/units.ts'
import {
  DIFFICULTY_SETTINGS,
  LAND_FRACTION,
  REQUIRED_EB_N0_DB,
  SCORE_WEIGHTS,
} from './parameters.ts'

/** erfc(x) = (2 / sqrt(pi)) * integral from x to infinity of exp(-t^2) dt, by Simpson's rule. */
function erfc(x: number): number {
  const steps = 20_000
  const width = 10 / steps // the integrand is below 1e-40 beyond x + 10
  let sum = 0
  for (let i = 0; i <= steps; i++) {
    const t = x + i * width
    const weight = i === 0 || i === steps ? 1 : i % 2 === 1 ? 4 : 2
    sum += weight * Math.exp(-t * t)
  }
  return (2 / Math.sqrt(Math.PI)) * (sum * width) / 3
}

/** Bit error rate of uncoded BPSK or QPSK: (1/2) erfc(sqrt(Eb/N0)). */
function bitErrorRate(ebN0Db: number): number {
  return 0.5 * erfc(Math.sqrt(fromDb(ebN0Db)))
}

describe('engineering parameters', () => {
  it('uses the Eb/N0 that gives a bit error rate of 1e-5', () => {
    expect(bitErrorRate(REQUIRED_EB_N0_DB)).toBeLessThanOrEqual(1e-5)
    expect(bitErrorRate(REQUIRED_EB_N0_DB - 0.1)).toBeGreaterThan(1e-5)
  })

  it('finds that about 29% of Earth is land', () => {
    expect(LAND_FRACTION).toBeCloseTo(0.292, 3)
  })
})

describe('game-design settings', () => {
  it('has score weights that add up to 100', () => {
    for (const weights of Object.values(SCORE_WEIGHTS)) {
      const total = Object.values(weights).reduce((sum: number, weight) => sum + weight, 0)
      expect(total).toBe(100)
    }
  })

  it('tightens margins and raises event chances with difficulty', () => {
    const { concept, 'trade-study': trade, 'point-design': point } = DIFFICULTY_SETTINGS
    expect(concept.eventFactor).toBe(0)
    expect(trade.massMargin).toBeGreaterThan(concept.massMargin)
    expect(point.massMargin).toBeGreaterThan(trade.massMargin)
    expect(point.powerMargin).toBeGreaterThan(trade.powerMargin)
    expect(point.eventFactor).toBeGreaterThan(trade.eventFactor)
  })
})
