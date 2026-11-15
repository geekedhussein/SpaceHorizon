import { describe, expect, it } from 'vitest'
import { catalog, referenceDesign, scenario } from '../../../tests/content.ts'
import {
  computeBudgets,
  costBudget,
  effectiveDragAreaM2,
  instrumentDataRateBps,
  linkRateBps,
  resolveDesign,
  sunlitArrayPowerW,
  totalMassKg,
} from './budgets.ts'
import type { Design, GroundStation, RadioPart } from './types.ts'

const vegetation = scenario('vegetation-monthly')

function budgetsFor(patch: Partial<Design> = {}) {
  const resolved = resolveDesign({ ...referenceDesign(), ...patch }, catalog)
  return { resolved, budgets: computeBudgets(resolved, vegetation) }
}

function mission(patch: Partial<Design> = {}) {
  const { budgets } = budgetsFor(patch)
  if (!budgets.mission) throw new Error('the design has no orbit')
  return budgets.mission
}

describe('resolveDesign', () => {
  it('looks up every id', () => {
    const { resolved } = budgetsFor()
    expect(resolved.unknownIds).toEqual([])
    expect(resolved.orbit?.altitude_km).toBe(500)
    expect(resolved.radios.map((radio) => radio.id)).toEqual(referenceDesign().radioIds)
  })

  it('reports ids that are missing or in the wrong slot', () => {
    const { resolved } = budgetsFor({ batteryId: 'no-such-part', computerId: 'radio-uhf-endurosat' })
    expect(resolved.unknownIds).toEqual(['no-such-part', 'radio-uhf-endurosat'])
    expect(resolved.battery).toBeNull()
    expect(resolved.computer).toBeNull()
  })
})

describe('mass and cost', () => {
  it('adds every part and each radio antenna', () => {
    // 0.304 + 0.468 + 0.5 + 0.123 + 0.207 + 0.9 + 0.246 + 0.396 + 0.51, plus
    // antennas 0.115 + 0.053.
    expect(totalMassKg(budgetsFor().resolved)).toBeCloseTo(3.822, 9)
  })

  it('charges ground passes for the whole planned mission', () => {
    const { budgets } = budgetsFor()
    expect(budgets.plannedDays).toBe(731)
    expect(budgets.cost.groundMusd).toBeCloseTo((10.5 * 731 * 491) / 1e6, 9)
    expect(budgets.cost.launchMusd).toBeCloseTo(0.35, 9)
    expect(budgets.cost.totalMusd).toBeCloseTo(
      budgets.cost.partsMusd + budgets.cost.launchMusd + budgets.cost.groundMusd,
      9,
    )
  })

  it('charges a rideshare for each kilogram above the included mass', () => {
    const { resolved } = budgetsFor()
    // Falcon 9 rideshare: $0.35M for 50 kg, then $0.007M per extra kg.
    expect(costBudget(resolved, 60, [], 731).launchMusd).toBeCloseTo(0.35 + 10 * 0.007, 9)
  })

  it('still gives mass and cost before an orbit is chosen', () => {
    const { budgets } = budgetsFor({ orbitId: null })
    expect(budgets.mission).toBeNull()
    expect(budgets.massKg).toBeCloseTo(3.822, 9)
    expect(budgets.cost.totalMusd).toBeGreaterThan(0)
  })
})

describe('links', () => {
  const svalbard = catalog.groundStations.find((entry) => entry.id === 'station-svalbard') as GroundStation
  const santiago = catalog.groundStations.find((entry) => entry.id === 'station-santiago') as GroundStation
  const xBand = catalog.components.find((entry) => entry.id === 'radio-xband-endurosat') as RadioPart
  const uhf = catalog.components.find((entry) => entry.id === 'radio-uhf-endurosat') as RadioPart

  it('gives no link when the station does not receive the frequency', () => {
    expect(linkRateBps(xBand, santiago, 500e3)).toBe(0)
    expect(linkRateBps(uhf, svalbard, 500e3)).toBe(0)
    expect(linkRateBps(xBand, svalbard, 500e3)).toBeGreaterThan(0)
  })

  it('carries less data from a higher orbit', () => {
    expect(linkRateBps(xBand, svalbard, 786e3)).toBeLessThan(linkRateBps(xBand, svalbard, 500e3))
  })

  it('uses the fastest radio the station hears, capped at the radio limit', () => {
    const [link] = mission().links
    expect(link.radioId).toBe('radio-xband-endurosat')
    expect(link.rateBps).toBe(xBand.max_data_rate_mbps * 1e6)
    expect(link.commands).toBe(true)
  })

  it('caps booked passes at what the orbit offers', () => {
    const [link] = mission({ groundStations: [{ stationId: 'station-svalbard', passesPerDay: 30 }] }).links
    expect(link.availablePassesPerDay).toBeGreaterThan(11)
    expect(link.availablePassesPerDay).toBeLessThan(12.5)
    expect(link.passesPerDay).toBe(link.availablePassesPerDay)
  })

  it('never sees a polar station from the space station orbit', () => {
    const [link] = mission({ orbitId: 'iss-like' }).links
    expect(link.availablePassesPerDay).toBe(0)
  })
})

describe('power and battery', () => {
  it('catches a quarter of the sunlight when tumbling', () => {
    const { resolved } = budgetsFor({ attitudeControlId: null })
    expect(sunlitArrayPowerW(resolved, 0)).toBeCloseTo(25.2 / 4, 9)
  })

  it('fades with age and with damage', () => {
    const { resolved } = budgetsFor()
    const fresh = sunlitArrayPowerW(resolved, 0)
    expect(sunlitArrayPowerW(resolved, 2)).toBeCloseTo(fresh * (1 - 0.0103) ** 2, 9)
    expect(sunlitArrayPowerW(resolved, 0, 0.5)).toBeCloseTo(fresh / 2, 9)
  })

  it('needs more than the average load, to recharge for the eclipse', () => {
    const { power } = mission()
    expect(power.essentialsRequiredW).toBeGreaterThan(power.loads.essentialsW)
    expect(power.requiredW).toBeGreaterThan(power.essentialsRequiredW)
    expect(power.margin).toBeGreaterThan(0)
  })

  it('only sends in sunlight when a pass would drain the battery too far', () => {
    // 5.95 W of always-on parts for a 35.8-minute eclipse is 3.5 Wh.
    expect(mission().battery.essentialsDepth).toBeCloseTo(3.546 / 36, 3)
    expect(mission().battery.transmitInEclipse).toBe(true)
    expect(mission({ batteryId: null }).battery.transmitInEclipse).toBe(false)
  })
})

describe('imaging and data', () => {
  const camera = catalog.instruments.find((entry) => entry.id === 'imager-multiscape50')
  if (!camera) throw new Error('camera missing from /content')

  it('uses the catalogue data rate at the reference altitude', () => {
    expect(instrumentDataRateBps(camera, 500e3)).toBeCloseTo(92.5e6, 3)
  })

  it('makes less data per second from higher up, where pixels are bigger', () => {
    expect(instrumentDataRateBps(camera, 705e3)).toBeLessThan(instrumentDataRateBps(camera, 500e3))
  })

  it('cannot image for longer than the time over sunlit land', () => {
    const { imaging } = mission({ imagingMinutesPerDay: 1000 })
    expect(imaging.plannedSPerDay).toBe(imaging.maxSPerDay)
    expect(imaging.maxSPerDay / 60).toBeGreaterThan(200)
    expect(imaging.maxSPerDay / 60).toBeLessThan(220)
  })

  it('takes no pictures without pointing or without a command link', () => {
    expect(mission({ attitudeControlId: null }).imaging.plannedSPerDay).toBe(0)
    expect(mission({ radioIds: ['radio-xband-endurosat'] }).imaging.plannedSPerDay).toBe(0)
  })

  it('judges the requirements on an instrument that serves the objective', () => {
    expect(mission({ instrumentIds: ['imager-gecko'] }).imaging.primary).toBeNull()
    const both = mission({ instrumentIds: ['imager-gecko', 'imager-multiscape50'] }).imaging
    expect(both.primary?.id).toBe('imager-multiscape50')
    expect(both.scienceShare).toBeCloseTo(92.5 / (92.5 + 3.7), 9)
  })
})

describe('drag', () => {
  it('uses the average shadow of a tumbling body plus its deployed panels', () => {
    // 3U body 100 x 100 x 340.5 mm: surface 0.1562 m2, a quarter of it is
    // 0.03905 m2. Panels 0.102 m2, half is 0.051 m2. Drag coefficient 2.
    expect(effectiveDragAreaM2(budgetsFor().resolved)).toBeCloseTo(2 * (0.03905 + 0.051), 9)
  })

  it('holds the orbit with a thruster and decays without one', () => {
    expect(mission().drag.reentryDay).toBeNull()
    const day = mission({ propulsionId: null }).drag.reentryDay
    expect(day).not.toBeNull()
    expect(day).toBeLessThan(731)
  })

  it('cannot use a thruster on a tumbling spacecraft', () => {
    expect(mission({ attitudeControlId: null }).drag.thrusterUsable).toBe(false)
  })
})
