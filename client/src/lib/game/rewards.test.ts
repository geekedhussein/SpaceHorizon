import { describe, expect, it } from 'vitest'
import { catalog, readyDesigns, referenceDesign, scenario } from '../../../tests/content.ts'
import { simulate } from '../sim/simulate.ts'
import type { Design, SimulationResult } from '../sim/types.ts'
import { award, bestKey, emptyProfile, parseProfile, starsFor, VETERAN_FLIGHTS } from './rewards.ts'

const vegetation = scenario('vegetation-monthly')
const orbitIds = catalog.orbits.map((orbit) => orbit.id)
const fly = (design: Design, options: { sandbox?: boolean; difficulty?: 'concept' | 'trade-study' } = {}) =>
  simulate(design, vegetation, 1, { catalog, difficulty: options.difficulty ?? 'concept', sandbox: options.sandbox })
const context = (design: Design, team = false) => ({ scenario: vegetation, design, orbitIds, team })
const ready = (id: string) => readyDesigns.find((entry) => entry.id === id)!.design

describe('stars', () => {
  it('gives three stars to a mission that meets everything', () => {
    expect(starsFor(fly(referenceDesign())).every((star) => star.earned)).toBe(true)
  })

  it('gives one star to a mission that reaches orbit but decays early', () => {
    // No thruster at 500 km: air drag brings it down before two years.
    const stars = starsFor(fly({ ...referenceDesign(), propulsionId: null }))
    expect(stars.map((star) => star.earned)).toEqual([true, false, false])
  })

  it('gives no star to a mission that never launched', () => {
    const grounded = fly({ ...referenceDesign(), launcherId: null }, { sandbox: true })
    expect(starsFor(grounded).some((star) => star.earned)).toBe(false)
  })
})

describe('badges and bests', () => {
  it('awards badges once, and remembers them', () => {
    const design = ready('low-orbit-low-cost')
    const first = award(fly(design), context(design), emptyProfile())
    expect(first.rewards.newBadges).toContain('first-orbit')
    expect(first.rewards.newBadges).toContain('all-requirements')
    expect(first.rewards.newBest).toBe(true)
    expect(first.rewards.previousBest).toBeNull()

    const again = award(fly(design), context(design), first.profile)
    expect(again.rewards.newBadges).toEqual([])
    expect(again.rewards.earned).toEqual(first.rewards.earned)
    expect(again.rewards.newBest).toBe(false)
    expect(again.profile.flights).toBe(2)
  })

  it('is thrifty only when every requirement is met for at most 40% of the budget', () => {
    const cheap = ready('low-orbit-low-cost')
    const costly = ready('high-orbit-own-rocket')
    expect(award(fly(cheap), context(cheap), emptyProfile()).rewards.earned).toContain('thrifty')
    expect(award(fly(costly), context(costly), emptyProfile()).rewards.earned).not.toContain('thrifty')
  })

  it('counts an overachiever when a requirement is beaten twice over', () => {
    // "More pictures" returns over twice the 1,000 GB a month asked for.
    const design = ready('more-pictures')
    const result = fly(design)
    const data = result.requirements.find((entry) => entry.id === 'data')!
    expect(data.value! / data.threshold).toBeGreaterThanOrEqual(2)
    expect(award(result, context(design), emptyProfile()).rewards.earned).toContain('overachiever')
  })

  it('records a new best only when the score goes up', () => {
    const design = ready('low-orbit-low-cost')
    const result = fly(design)
    const key = bestKey(result.scenarioId, result.difficulty)
    const higher = { ...emptyProfile(), bests: { [key]: result.score.total + 1 } }
    const lower = { ...emptyProfile(), bests: { [key]: result.score.total - 1 } }
    expect(award(result, context(design), higher).rewards.newBest).toBe(false)
    expect(award(result, context(design), lower).rewards).toMatchObject({ newBest: true, previousBest: result.score.total - 1 })
    expect(award(result, context(design), lower).profile.bests[key]).toBe(result.score.total)
  })

  it('gives sandbox flights stars but no badges, bests or flights', () => {
    const design = ready('low-orbit-low-cost')
    const { rewards, profile } = award(fly(design, { sandbox: true }), context(design), emptyProfile())
    expect(rewards.stars.every((star) => star.earned)).toBe(true)
    expect(rewards).toMatchObject({ earned: [], newBadges: [], newBest: false, counted: false })
    expect(profile).toEqual(emptyProfile())
  })

  it('makes an orbit explorer of a player who has flown to every orbit', () => {
    const design = ready('high-orbit-own-rocket')
    const others = orbitIds.filter((id) => id !== design.orbitId)
    const { rewards } = award(fly(design), context(design), { ...emptyProfile(), orbits: others })
    expect(rewards.newBadges).toContain('orbit-explorer')
  })

  it('makes a veteran after ten flights that reached orbit', () => {
    const design = ready('low-orbit-low-cost')
    const result = fly(design)
    const before = { ...emptyProfile(), flights: VETERAN_FLIGHTS - 2 }
    expect(award(result, context(design), before).rewards.earned).not.toContain('veteran')
    expect(award(result, context(design), { ...before, flights: VETERAN_FLIGHTS - 1 }).rewards.earned).toContain('veteran')
  })

  it('awards team effort only in a team where everyone took part', () => {
    const design = ready('low-orbit-low-cost')
    const withTeam = (collaboration: number): SimulationResult =>
      simulate(design, vegetation, 1, { catalog, difficulty: 'concept', collaboration })
    expect(award(withTeam(1), context(design, true), emptyProfile()).rewards.earned).toContain('team-effort')
    expect(award(withTeam(0.5), context(design, true), emptyProfile()).rewards.earned).not.toContain('team-effort')
    expect(award(fly(design), context(design), emptyProfile()).rewards.earned).not.toContain('team-effort')
  })

  it('awards the level badges only at that level', () => {
    const design = ready('low-orbit-low-cost')
    const concept = award(fly(design), context(design), emptyProfile()).rewards.earned
    expect(concept).not.toContain('trade-study')
    // Seed 1 reaches orbit at Trade study (launch failures are on at that level).
    const trade = fly(design, { difficulty: 'trade-study' })
    expect(trade.outcome.status).toBe('completed')
    const earned = award(trade, context(design), emptyProfile()).rewards.earned
    expect(earned).toContain('trade-study')
    expect(earned).not.toContain('point-design')
  })
})

describe('stored profile', () => {
  it('reads back what it wrote', () => {
    const profile = { flights: 3, orbits: ['sso-500'], badges: ['first-orbit' as const], bests: { 'a|concept': 80 } }
    expect(parseProfile(JSON.stringify(profile))).toEqual(profile)
  })

  it('drops damaged or unknown fields', () => {
    expect(parseProfile('not json')).toEqual(emptyProfile())
    expect(parseProfile(null)).toEqual(emptyProfile())
    const odd = parseProfile(JSON.stringify({ flights: -1, orbits: [3, 'x'], badges: ['made-up', 'veteran'], bests: { k: 'high' } }))
    expect(odd).toEqual({ flights: 0, orbits: ['x'], badges: ['veteran'], bests: {} })
  })
})
