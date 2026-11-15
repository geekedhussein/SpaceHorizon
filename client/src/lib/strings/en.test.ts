import { describe, expect, it } from 'vitest'
import { catalog, referenceDesign, scenario } from '../../../tests/content.ts'
import { simulate } from '../sim/simulate.ts'
import type { Design, SimulationContext } from '../sim/types.ts'
import { causeTexts, checkTexts, describeCause, describeCheck, fillTemplate, physicsTooltips } from './en.ts'

function expectPlain(text: string, label: string): void {
  expect(text.length, label).toBeLessThanOrEqual(280)
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    expect(sentence.split(/\s+/).length, `${label}: ${sentence}`).toBeLessThanOrEqual(25)
  }
}

describe('physics tooltips', () => {
  const entries = Object.entries(physicsTooltips)

  it('has a title and a text for every concept', () => {
    expect(entries.length).toBeGreaterThan(0)
    for (const [id, tooltip] of entries) {
      expect(tooltip.title.trim(), id).not.toBe('')
      expect(tooltip.text.trim(), id).not.toBe('')
    }
  })

  it('keeps every tooltip short, in short sentences', () => {
    for (const [id, tooltip] of entries) {
      expect(tooltip.text.length, id).toBeLessThanOrEqual(280)
      for (const sentence of tooltip.text.split(/(?<=[.!?])\s+/)) {
        expect(sentence.split(/\s+/).length, `${id}: ${sentence}`).toBeLessThanOrEqual(25)
      }
    }
  })
})

describe('fillTemplate', () => {
  it('fills slots and rounds numbers for reading', () => {
    expect(fillTemplate('{a} kg of {b}', { a: 3.8216, b: 'mass' })).toBe('3.8 kg of mass')
    expect(fillTemplate('{a}', { a: 0.00761 })).toBe('0.0076')
    expect(fillTemplate('{a}', { a: 12345.67 })).toBe('12,345.7')
  })

  it('leaves an unknown slot visible, so a test can catch it', () => {
    expect(fillTemplate('{missing}', {})).toBe('{missing}')
  })
})

describe('check and explanation texts', () => {
  it('keeps every template short, in short sentences', () => {
    for (const [id, entry] of Object.entries(checkTexts)) {
      expect(entry.title.trim(), id).not.toBe('')
      for (const text of [entry.ok, entry.problem, entry.fix]) expectPlain(text, id)
    }
    for (const [id, entry] of Object.entries(causeTexts)) {
      expect(entry.text.trim(), id).not.toBe('')
      expectPlain(entry.text, id)
      expectPlain(entry.fix, id)
    }
  })

  it('fills every slot from real simulation runs', () => {
    const vegetation = scenario('vegetation-monthly')
    // TEST FIXTURE, not real data: an event that always happens.
    const events = [
      { id: 'test', name: 'Test storm', probability_per_year: 1, effect: { kind: 'array_damage' as const, power_loss_fraction: 0.2 } },
    ]
    const runs: [Partial<Design>, Partial<SimulationContext>][] = [
      [{}, {}],
      [{}, { difficulty: 'trade-study', events }],
      [{ orbitId: null, computerId: null, batteryId: 'made-up' }, {}],
      [{ orbitId: 'iss-like' }, {}],
      [{ launcherId: 'firefly-alpha' }, {}],
      [{ launcherId: 'electron', orbitId: 'landsat-705' }, { sandbox: true }],
      [{ propulsionId: null }, {}],
      [{ solarArrayId: 'solar-panel-3u-endurosat' }, {}],
      [{ solarArrayId: 'solar-deployable-6u-endurosat' }, {}],
      [{ batteryId: null }, {}],
      [{ solarArrayId: null }, {}],
      [{ attitudeControlId: null }, {}],
      [{ radioIds: ['radio-sband-endurosat'] }, {}],
      [{ radioIds: ['radio-xband-endurosat'] }, {}],
      [{ radioIds: ['radio-uhf-endurosat'] }, {}],
      [{ radioIds: [], groundStations: [] }, {}],
      [{ instrumentIds: [] }, {}],
      [{ instrumentIds: ['imager-gecko'] }, {}],
      [{ instrumentIds: ['imager-multiscape100'] }, {}],
      [{ instrumentIds: ['imager-multiscape50', 'imager-multiscape100', 'imager-gecko'] }, {}],
      [{ imagingMinutesPerDay: 40 }, {}],
      [{ imagingMinutesPerDay: 200 }, {}],
      [{ groundStations: [{ stationId: 'station-svalbard', passesPerDay: 30 }] }, {}],
    ]
    const seenChecks = new Set<string>()
    const seenCauses = new Set<string>()
    for (const [patch, context] of runs) {
      const result = simulate({ ...referenceDesign(), ...patch }, vegetation, 1, {
        catalog,
        difficulty: 'concept',
        ...context,
      })
      for (const check of result.checks) {
        const { title, text, fix } = describeCheck(check)
        if (check.status !== 'ok') seenChecks.add(check.id)
        for (const part of [title, text, fix]) expect(part, check.id).not.toMatch(/[{}]|NaN|undefined|null/)
      }
      for (const cause of result.causes) {
        const { text, fix } = describeCause(cause)
        seenCauses.add(cause.id)
        for (const part of [text, fix]) expect(part, cause.id).not.toMatch(/[{}]|NaN|undefined|null/)
      }
    }
    // Most texts are exercised by the runs above; list what is not, so a new
    // text without a run is noticed.
    const unseen = (all: object, seen: Set<string>) => Object.keys(all).filter((id) => !seen.has(id)).sort()
    expect(unseen(checkTexts, seenChecks)).toEqual(['battery_depth', 'cubesat_mass', 'launch_mass'])
    expect(unseen(causeTexts, seenCauses)).toEqual(['eclipse_transmit_blocked', 'launch_failed', 'propellant_empty', 'resolution_missed'])
  })
})
