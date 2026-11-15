import { describe, expect, it } from 'vitest'
import { catalog, referenceDesign, scenario } from '../../../tests/content.ts'
import { dailyProbability, simulate } from './simulate.ts'
import type {
  Catalog,
  CauseId,
  Design,
  Difficulty,
  MissionEvent,
  SimulationContext,
  SimulationResult,
} from './types.ts'

const vegetation = scenario('vegetation-monthly')

function run(
  patch: Partial<Design> = {},
  options: Partial<SimulationContext> & { seed?: number } = {},
): SimulationResult {
  const { seed = 1, ...context } = options
  return simulate({ ...referenceDesign(), ...patch }, vegetation, seed, {
    catalog,
    difficulty: 'concept',
    ...context,
  })
}

const causeIds = (result: SimulationResult): CauseId[] => result.causes.map((cause) => cause.id)
const value = (result: SimulationResult, id: string): number | null | undefined =>
  result.requirements.find((entry) => entry.id === id || entry.metric === id)?.value
const met = (result: SimulationResult, metric: string): boolean | undefined =>
  result.requirements.find((entry) => entry.metric === metric)?.met

// TEST FIXTURES, not real data: events with made-up chances, to exercise each
// effect. Real events arrive in /content/events.json at build step 8.
const always = (id: string, effect: MissionEvent['effect']): MissionEvent => ({
  id,
  name: `Test ${id}`,
  probability_per_year: 1,
  effect,
})
const sometimes: MissionEvent[] = [
  { id: 'test-safe-mode', name: 'Test fault', probability_per_year: 0.9, effect: { kind: 'safe_mode', duration_days: 3 } },
  { id: 'test-outage', name: 'Test outage', probability_per_year: 0.9, effect: { kind: 'station_outage', duration_days: 2 } },
]

/** TEST FIXTURE, not real data: the catalogue with one launcher's record replaced. */
function catalogWithLaunchRecord(successes: number, attempts: number): Catalog {
  return {
    ...catalog,
    launchers: catalog.launchers.map((entry) =>
      entry.id === 'falcon9-rideshare'
        ? { ...entry, launch_successes: successes, launch_attempts: attempts }
        : entry,
    ),
  }
}

describe('determinism and purity', () => {
  it('gives deep-equal results for the same inputs and seed', () => {
    const options = { difficulty: 'trade-study' as Difficulty, events: sometimes, seed: 42 }
    expect(run({}, options)).toEqual(run({}, options))
  })

  it('gives different event histories for different seeds', () => {
    const a = run({}, { difficulty: 'trade-study', events: sometimes, seed: 1 })
    const b = run({}, { difficulty: 'trade-study', events: sometimes, seed: 2 })
    expect(a.events).not.toEqual(b.events)
  })

  it('does not change its inputs', () => {
    const design = referenceDesign()
    const before = JSON.stringify([design, vegetation, catalog, sometimes])
    simulate(design, vegetation, 7, { catalog, difficulty: 'trade-study', events: sometimes })
    expect(JSON.stringify([design, vegetation, catalog, sometimes])).toBe(before)
  })

  it('survives a round trip through JSON, for saving and sharing', () => {
    const result = run()
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('rolls the same events whatever the design', () => {
    const options = { difficulty: 'trade-study' as Difficulty, events: [sometimes[0]], seed: 5 }
    const a = run({}, options)
    const b = run({ imagingMinutesPerDay: 40, batteryId: 'battery-36wh-orbastro' }, options)
    expect(a.events.length).toBeGreaterThan(0)
    expect(b.events).toEqual(a.events)
  })
})

describe('the reference mission', () => {
  const result = run()

  it('flies its whole planned life', () => {
    expect(result.outcome).toEqual({ status: 'completed', endDay: 731 })
    expect(result.steps).toHaveLength(731)
    expect(result.steps.map((step) => step.day)).toEqual(Array.from({ length: 731 }, (_, i) => i + 1))
    expect(result.checks.every((check) => check.status === 'ok')).toBe(true)
  })

  it('meets every requirement, but not by a wide margin', () => {
    expect(result.requirements.map((entry) => entry.met)).toEqual([true, true, true, true])
    expect(value(result, 'revisit_days')).toBeGreaterThan(25)
    expect(value(result, 'revisit_days')).toBeLessThanOrEqual(30)
    expect(value(result, 'ground_resolution_m')).toBeCloseTo(30, 6)
    expect(value(result, 'data_returned_gb_per_month')).toBeGreaterThan(1000)
    expect(value(result, 'data_returned_gb_per_month')).toBeLessThan(2200)
    expect(value(result, 'lifetime_years')).toBe(2)
    expect(causeIds(result)).toEqual(['all_requirements_met'])
  })

  it('shows the score as a breakdown that adds up', () => {
    const { total, parts } = result.score
    expect(parts.map((part) => part.id)).toEqual(['requirements', 'survival', 'efficiency'])
    expect(parts[0].points).toBe(55)
    expect(parts[1].points).toBe(25)
    expect(total).toBeCloseTo(parts.reduce((sum, part) => sum + part.points, 0), 9)
    expect(total).toBeGreaterThan(85)
    expect(total).toBeLessThan(100)
  })

  it('keeps a consistent data account', () => {
    const { totals } = result
    expect(totals.dataGeneratedGb).toBeCloseTo(
      totals.dataDownlinkedGb + totals.dataLostGb + totals.dataStrandedGb,
      6,
    )
    const sum = (pick: (step: SimulationResult['steps'][number]) => number) =>
      result.steps.reduce((total, step) => total + pick(step), 0)
    expect(sum((step) => step.dataGeneratedGb)).toBeCloseTo(totals.dataGeneratedGb, 6)
    expect(sum((step) => step.dataDownlinkedGb)).toBeCloseTo(totals.dataDownlinkedGb, 6)
  })

  it('holds its altitude with the thruster and generates more than it uses', () => {
    expect(result.totals.finalAltitudeKm).toBeCloseTo(500, 3)
    expect(result.totals.propellantUsedKg).toBeGreaterThan(0)
    expect(result.totals.propellantUsedKg).toBeLessThan(0.22)
    for (const step of [result.steps[0], result.steps[730]]) {
      expect(step.generationW).toBeGreaterThan(step.consumptionW)
      expect(step.depthOfDischarge).toBeLessThanOrEqual(0.4)
    }
    expect(result.steps[730].sunlitPowerW).toBeLessThan(result.steps[0].sunlitPowerW)
  })

  it('scores a team game with a collaboration part', () => {
    const team = run({}, { collaboration: 1 })
    expect(team.score.parts.map((part) => part.id)).toContain('collaboration')
    expect(team.score.parts.find((part) => part.id === 'collaboration')?.points).toBe(10)
  })
})

describe('designs that go wrong, and why', () => {
  it('does not launch a blocked design', () => {
    const result = run({ orbitId: 'iss-like' })
    expect(result.outcome).toEqual({ status: 'not_launched', endDay: 0 })
    expect(result.steps).toEqual([])
    expect(result.score.total).toBe(0)
    expect(causeIds(result)).toEqual(['not_launched'])
    expect(result.checks.find((check) => check.id === 'orbit_not_served')?.status).toBe('blocked')
  })

  it('launches an over-budget design in sandbox mode only', () => {
    expect(run({ launcherId: 'firefly-alpha' }).outcome.status).toBe('not_launched')
    const sandbox = run({ launcherId: 'firefly-alpha' }, { sandbox: true })
    expect(sandbox.outcome.status).toBe('completed')
    expect(sandbox.sandbox).toBe(true)
    expect(sandbox.score.total).toBeLessThan(run().score.total)
  })

  it('falls out of orbit without a thruster', () => {
    const result = run({ propulsionId: null })
    expect(result.outcome.status).toBe('reentered')
    expect(result.outcome.endDay).toBeGreaterThan(300)
    expect(result.outcome.endDay).toBeLessThan(500)
    expect(causeIds(result)).toContain('reentered')
    expect(met(result, 'lifetime_years')).toBe(false)
    expect(result.steps.at(-1)?.altitudeKm).toBeLessThan(result.steps[0].altitudeKm)
    expect(result.score.parts[1].points).toBeLessThan(25)
  })

  it('dies at once when the array cannot power the always-on parts', () => {
    const result = run({ solarArrayId: 'solar-panel-3u-endurosat' })
    expect(result.outcome).toEqual({ status: 'power_lost', endDay: 0 })
    expect(causeIds(result)).toContain('power_lost_array')
    expect(result.requirements.every((entry) => !entry.met)).toBe(true)
  })

  it('dies in the first eclipse without a battery', () => {
    const result = run({ batteryId: null })
    expect(result.outcome.status).toBe('power_lost')
    expect(causeIds(result)).toContain('power_lost_battery')
  })

  it('tumbles without attitude control: little power, no pictures, no thrust', () => {
    const result = run({ attitudeControlId: null })
    expect(result.outcome.status).toBe('power_lost')
    expect(causeIds(result)).toEqual(expect.arrayContaining(['power_lost_array', 'no_pointing', 'thruster_unpointed']))
  })

  it('loses most pictures when the radio is too slow', () => {
    const result = run({ radioIds: ['radio-sband-endurosat'] })
    expect(result.outcome.status).toBe('completed')
    expect(result.totals.dataLostGb).toBeGreaterThan(0.9 * result.totals.dataGeneratedGb)
    expect(causeIds(result)).toEqual(expect.arrayContaining(['data_lost', 'revisit_data', 'data_downlink_limited']))
    expect(met(result, 'ground_resolution_m')).toBe(true)
  })

  it('takes no pictures without a way to receive commands', () => {
    const result = run({ radioIds: ['radio-xband-endurosat'] })
    expect(result.totals.dataGeneratedGb).toBe(0)
    expect(causeIds(result)).toEqual(['no_command_link'])
    expect(value(result, 'ground_resolution_m')).toBeNull()
  })

  it('returns nothing when no station hears the radio', () => {
    for (const patch of [{ radioIds: ['radio-uhf-endurosat'] }, { groundStations: [] }]) {
      const result = run(patch)
      expect(result.totals.dataDownlinkedGb).toBe(0)
      expect(causeIds(result)).toEqual(['no_command_link', 'no_downlink'])
    }
  })

  it('names the instrument when it does not serve the objective', () => {
    const none = run({ instrumentIds: [] })
    expect(causeIds(none)).toContain('no_instrument')
    const wrong = run({ instrumentIds: ['imager-gecko'] })
    expect(causeIds(wrong)).toContain('instrument_unsuitable')
    expect(met(wrong, 'data_returned_gb_per_month')).toBe(false)
  })

  it('misses the revisit time with a narrow swath, whatever the data volume', () => {
    const result = run({ instrumentIds: ['imager-multiscape100'] })
    expect(causeIds(result)).toContain('revisit_swath')
    expect(met(result, 'ground_resolution_m')).toBe(true)
    expect(met(result, 'revisit_days')).toBe(false)
  })

  it('sees less detail from a higher orbit', () => {
    const design = { ...referenceDesign(), orbitId: 'landsat-705', launcherId: 'electron' }
    const result = simulate(design, vegetation, 1, { catalog, difficulty: 'concept' })
    expect(value(result, 'ground_resolution_m')).toBeCloseTo(30 * (705 / 500), 6)
    expect(met(result, 'ground_resolution_m')).toBe(true)

    // TEST FIXTURE: the same scenario asking for 30 m, which 705 km cannot give.
    const sharp = {
      ...vegetation,
      requirements: vegetation.requirements.map((entry) =>
        entry.metric === 'ground_resolution_m' ? { ...entry, threshold: 30 } : entry,
      ),
    }
    const missed = simulate(design, sharp, 1, { catalog, difficulty: 'concept' })
    expect(causeIds(missed)).toContain('resolution_missed')
  })

  it('offers more than one orbit that meets every requirement', () => {
    const higher = run({
      orbitId: 'sentinel2-786',
      launcherId: 'electron',
      propulsionId: null,
      groundStations: [{ stationId: 'station-fairbanks', passesPerDay: 4 }],
      imagingMinutesPerDay: 80,
    })
    expect(higher.requirements.every((entry) => entry.met)).toBe(true)
    expect(higher.checks.every((check) => check.status !== 'blocked')).toBe(true)
  })

  it('images too little or too much', () => {
    const little = run({ imagingMinutesPerDay: 40 })
    expect(causeIds(little)).toEqual(['revisit_data', 'data_imaging_limited'])
    expect(little.totals.dataLostGb).toBe(0)

    const much = run({ imagingMinutesPerDay: 200 })
    expect(much.requirements.every((entry) => entry.met)).toBe(true)
    expect(causeIds(much)).toContain('data_lost')
    expect(much.score.total).toBeLessThan(run().score.total)
  })

  it('returns less data through a station that cannot hear X-band', () => {
    const result = run({ groundStations: [{ stationId: 'station-santiago', passesPerDay: 4 }] })
    expect(causeIds(result)).toContain('data_downlink_limited')
  })
})

describe('random events', () => {
  it('turns a yearly chance into a daily one', () => {
    expect(dailyProbability(0, 1)).toBe(0)
    expect(dailyProbability(1, 1)).toBe(1)
    const daily = dailyProbability(0.5, 1)
    expect(1 - (1 - daily) ** 365.25).toBeCloseTo(0.5, 9)
    expect(dailyProbability(0.5, 2)).toBeCloseTo(2 * daily, 12)
    expect(dailyProbability(0.5, 0)).toBe(0)
  })

  it('has no events at the concept level', () => {
    const events = [always('test-damage', { kind: 'array_damage', power_loss_fraction: 0.5 })]
    const result = run({}, { events })
    expect(result.events).toEqual([])
    expect(result).toEqual(run())
  })

  it('stops imaging and sending in safe mode', () => {
    const result = run({}, { difficulty: 'trade-study', events: [always('test-safe', { kind: 'safe_mode', duration_days: 1 })] })
    expect(result.outcome.status).toBe('completed')
    expect(result.events).toHaveLength(731)
    expect(result.totals.dataGeneratedGb).toBe(0)
    expect(result.steps.every((step) => step.imagingActivity === 0 && step.downlinkActivity === 0)).toBe(true)
    const line = result.causes.find((cause) => cause.id === 'event')
    expect(line?.values).toEqual({ name: 'Test test-safe', day: 1, count: 731 })
  })

  it('takes the booked station out of service', () => {
    const result = run({}, { difficulty: 'trade-study', events: [always('test-outage', { kind: 'station_outage', duration_days: 1 })] })
    expect(result.events.every((entry) => entry.stationId === 'station-svalbard')).toBe(true)
    expect(result.totals.dataDownlinkedGb).toBe(0)
    expect(result.totals.dataLostGb).toBeGreaterThan(0)
  })

  it('wears the array down until the power fails', () => {
    const result = run({}, { difficulty: 'trade-study', events: [always('test-damage', { kind: 'array_damage', power_loss_fraction: 0.2 })] })
    expect(result.outcome.status).toBe('power_lost')
    expect(result.outcome.endDay).toBeGreaterThan(0)
    expect(result.outcome.endDay).toBeLessThan(10)
    expect(causeIds(result)).toEqual(expect.arrayContaining(['power_shortage', 'power_lost_array', 'event']))
    expect(result.steps.at(-1)?.arrayHealth).toBeLessThan(1)
  })

  it('can lose the mission at launch, but never at the concept level', () => {
    const neverWorks = catalogWithLaunchRecord(0, 10)
    expect(run({}, { catalog: neverWorks }).outcome.status).toBe('completed')
    const failed = run({}, { catalog: neverWorks, difficulty: 'trade-study' })
    expect(failed.outcome).toEqual({ status: 'launch_failed', endDay: 0 })
    expect(causeIds(failed)).toEqual(['launch_failed'])
    expect(failed.score.parts[0].points).toBe(0)

    const alwaysWorks = catalogWithLaunchRecord(10, 10)
    for (const seed of [1, 2, 3, 4, 5]) {
      expect(run({}, { catalog: alwaysWorks, difficulty: 'trade-study', seed }).outcome.status).toBe('completed')
    }
  })
})

describe('difficulty', () => {
  it('changes margins and events, never the physics', () => {
    const concept = run()
    const hard = run({}, { difficulty: 'point-design', catalog: catalogWithLaunchRecord(10, 10) })
    expect(hard.steps).toEqual(concept.steps)
    expect(hard.requirements).toEqual(concept.requirements)
  })
})
