import { describe, expect, it } from 'vitest'
import { catalog, referenceDesign, scenario } from '../../../tests/content.ts'
import { checkDesign } from '../sim/constraints.ts'
import type { Design } from '../sim/types.ts'
import { resourceBars } from './resourceBars.ts'

const vegetation = scenario('vegetation-monthly')

function bars(design: Design) {
  const { resolved, budgets } = checkDesign(design, vegetation, { catalog, difficulty: 'concept' })
  return Object.fromEntries(resourceBars(resolved, budgets, vegetation, 'concept').map((bar) => [bar.id, bar]))
}

describe('resource bars', () => {
  it('always lists the six resources, in order', () => {
    const { resolved, budgets } = checkDesign(referenceDesign(), vegetation, { catalog, difficulty: 'concept' })
    expect(resourceBars(resolved, budgets, vegetation, 'concept').map((bar) => bar.id)).toEqual([
      'mass',
      'power',
      'budget',
      'data',
      'comms',
      'time',
    ])
  })

  it('shows the reference design inside every limit', () => {
    for (const bar of Object.values(bars(referenceDesign()))) {
      expect(bar.status, bar.id).not.toBe('over')
      expect(bar.status, bar.id).not.toBe('none')
      expect(bar.fraction, bar.id).toBeGreaterThan(0)
      expect(bar.fraction, bar.id).toBeLessThanOrEqual(1)
    }
  })

  it('has nothing to compare for an empty design, except the budget', () => {
    const empty = bars({
      ...referenceDesign(),
      orbitId: null,
      launcherId: null,
      structureId: null,
      groundStations: [],
    })
    expect(empty.power.status).toBe('none')
    expect(empty.data.status).toBe('none')
    expect(empty.comms.status).toBe('none')
    expect(empty.time.status).toBe('none')
    expect(empty.budget.status).toBe('ok')
  })

  it('goes over when the plan asks for more than the design gives', () => {
    const greedy = bars({
      ...referenceDesign(),
      solarArrayId: 'solar-panel-3u-endurosat',
      radioIds: ['radio-sband-endurosat'],
      groundStations: [{ stationId: 'station-svalbard', passesPerDay: 30 }],
    })
    expect(greedy.power.status).toBe('over')
    expect(greedy.data.status).toBe('over')
    expect(greedy.comms.status).toBe('over')
  })

  it('marks the time bar short when drag ends the mission early', () => {
    const low = bars({ ...referenceDesign(), orbitId: 'iss-like', launcherId: 'electron', propulsionId: null })
    expect(low.time.moreIsBetter).toBe(true)
    expect(low.time.status).toBe('over')
    expect(low.time.used).toBeLessThan(vegetation.planned_lifetime_years)
  })
})
