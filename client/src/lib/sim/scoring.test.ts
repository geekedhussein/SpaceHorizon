import { describe, expect, it } from 'vitest'
import { evaluateRequirement, marginScore, scoreMission, zeroScore } from './scoring.ts'
import type { Requirement } from './types.ts'

const atMost: Requirement = {
  id: 'revisit',
  label: '',
  metric: 'revisit_days',
  comparator: '<=',
  threshold: 30,
  unit: 'days',
  why_it_matters: '',
}
const atLeast: Requirement = { ...atMost, id: 'data', metric: 'data_returned_gb_per_month', comparator: '>=', threshold: 2000 }

describe('evaluateRequirement', () => {
  it('passes at the threshold', () => {
    expect(evaluateRequirement(atMost, 30)).toMatchObject({ met: true, achievement: 1 })
    expect(evaluateRequirement(atLeast, 2000)).toMatchObject({ met: true, achievement: 1 })
  })

  it('gives part marks for a near miss', () => {
    expect(evaluateRequirement(atMost, 60)).toMatchObject({ met: false, achievement: 0.5 })
    expect(evaluateRequirement(atLeast, 500)).toMatchObject({ met: false, achievement: 0.25 })
  })

  it('gives nothing when the quantity was never achieved', () => {
    expect(evaluateRequirement(atMost, null)).toMatchObject({ met: false, achievement: 0, value: null })
  })
})

describe('marginScore', () => {
  it('rewards sensible margins, not shortfalls or waste', () => {
    expect(marginScore(-0.1)).toBe(0)
    expect(marginScore(null)).toBe(0)
    expect(marginScore(0)).toBe(1)
    expect(marginScore(0.5)).toBe(1)
    expect(marginScore(1.25)).toBeCloseTo(0.5, 12)
    expect(marginScore(2)).toBe(0)
    expect(marginScore(5)).toBe(0)
  })
})

describe('scoreMission', () => {
  const met = [evaluateRequirement(atMost, 20), evaluateRequirement(atLeast, 2500)]
  const perfect = {
    requirements: met,
    operatedDays: 731,
    plannedDays: 731,
    costMusd: 5,
    budgetMusd: 10,
    margins: [0.2, 0.1],
  }

  it('shows a breakdown that adds up to the total', () => {
    const score = scoreMission(perfect)
    expect(score.parts.map((part) => part.id)).toEqual(['requirements', 'survival', 'efficiency'])
    expect(score.parts.reduce((sum, part) => sum + part.points, 0)).toBeCloseTo(score.total, 9)
    // 55 + 25 + 20 x (0.5 x half the budget unused + 0.5 x full margin marks)
    expect(score.total).toBe(95)
  })

  it('scales survival with the days flown', () => {
    const score = scoreMission({ ...perfect, operatedDays: 365.5 })
    expect(score.parts.find((part) => part.id === 'survival')?.fraction).toBeCloseTo(0.5, 12)
  })

  it('gives no efficiency marks to a cheap mission that achieved nothing', () => {
    const nothing = [evaluateRequirement(atMost, null), evaluateRequirement(atLeast, 0)]
    const score = scoreMission({ ...perfect, requirements: nothing, costMusd: 0.1 })
    expect(score.parts.find((part) => part.id === 'efficiency')?.points).toBe(0)
  })

  it('adds a collaboration part in team mode only', () => {
    const team = scoreMission({ ...perfect, collaboration: 1 })
    expect(team.parts.map((part) => part.id)).toContain('collaboration')
    expect(team.parts.reduce((sum, part) => sum + part.weight, 0)).toBe(100)
    expect(scoreMission({ ...perfect, collaboration: 0 }).total).toBeLessThan(team.total)
  })

  it('never goes above 100 or below 0', () => {
    expect(scoreMission({ ...perfect, costMusd: 0, collaboration: 3 }).total).toBeLessThanOrEqual(100)
    expect(scoreMission({ ...perfect, requirements: [], operatedDays: 0, costMusd: 50 }).total).toBe(0)
    expect(zeroScore(true).total).toBe(0)
  })
})
