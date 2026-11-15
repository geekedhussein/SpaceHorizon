// The ready-made designs in /content/ready_designs.json must stay launchable:
// if a part's figures change, these tests say which design broke and why.
import { describe, expect, it } from 'vitest'
import { catalog, readyDesigns, scenario } from '../../../tests/content.ts'
import { checkDesign } from '../sim/constraints.ts'
import { simulate } from '../sim/simulate.ts'
import type { Difficulty } from '../sim/types.ts'

const LEVELS: Difficulty[] = ['concept', 'trade-study', 'point-design']
const byId = (id: string) => {
  const found = readyDesigns.find((ready) => ready.id === id)
  if (!found) throw new Error(`No ready-made design ${id}`)
  return found
}
const fly = (id: string) => {
  const ready = byId(id)
  return simulate(ready.design, scenario(ready.scenario_id), 0, { catalog, difficulty: 'concept', sandbox: true })
}

describe.each(readyDesigns.map((ready) => [ready.id, ready] as const))('ready-made design %s', (_id, ready) => {
  it.each(LEVELS)('passes every pre-launch check at the %s level', (difficulty) => {
    const { resolved, checks } = checkDesign(ready.design, scenario(ready.scenario_id), { catalog, difficulty })
    expect(resolved.unknownIds).toEqual([])
    expect(checks.filter((check) => check.status !== 'ok')).toEqual([])
  })

  it('meets every requirement and lasts its planned life', () => {
    const result = fly(ready.id)
    expect(result.outcome.status).toBe('completed')
    expect(result.requirements.filter((requirement) => !requirement.met)).toEqual([])
  })
})

describe('what the ready-made designs say about themselves', () => {
  const cost = (id: string) => {
    const ready = byId(id)
    return checkDesign(ready.design, scenario(ready.scenario_id), { catalog, difficulty: 'concept' }).budgets
  }

  it('"Low orbit, low cost" is the cheapest, and needs its thruster at 500 km', () => {
    const cheapest = Math.min(...readyDesigns.map((ready) => cost(ready.id).cost.totalMusd))
    expect(cost('low-orbit-low-cost').cost.totalMusd).toBe(cheapest)
    const ready = byId('low-orbit-low-cost')
    const { checks } = checkDesign({ ...ready.design, propulsionId: null }, scenario(ready.scenario_id), {
      catalog,
      difficulty: 'concept',
    })
    expect(checks.find((check) => check.id === 'orbit_lifetime')?.status).toBe('risk')
  })

  it('"More pictures" returns more data, for about US$2 million more', () => {
    const data = (id: string) => fly(id).requirements.find((requirement) => requirement.id === 'data')?.value ?? 0
    expect(data('more-pictures')).toBeGreaterThan(data('low-orbit-low-cost') * 1.3)
    expect(cost('more-pictures').cost.totalMusd - cost('low-orbit-low-cost').cost.totalMusd).toBeCloseTo(2, 0)
  })

  it('"High orbit" is the lightest and spends most of the budget on its rocket', () => {
    const lightest = Math.min(...readyDesigns.map((ready) => cost(ready.id).massKg))
    expect(cost('high-orbit-own-rocket').massKg).toBe(lightest)
    const launcher = catalog.launchers.find((entry) => entry.id === 'electron')
    expect(launcher!.cost_musd / scenario('vegetation-monthly').budget_musd).toBeGreaterThan(0.5)
  })

  it('"Room to grow" is heavier and costs more than the 3U design it grows from', () => {
    expect(cost('roomy-6u').massKg).toBeGreaterThan(cost('low-orbit-low-cost').massKg)
    expect(cost('roomy-6u').cost.totalMusd).toBeGreaterThan(cost('low-orbit-low-cost').cost.totalMusd)
    expect(fly('roomy-6u').score.total).toBeLessThan(fly('low-orbit-low-cost').score.total)
  })
})
