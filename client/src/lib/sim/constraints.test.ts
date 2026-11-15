import { describe, expect, it } from 'vitest'
import { catalog, referenceDesign, scenario } from '../../../tests/content.ts'
import { checkDesign, isBlocked } from './constraints.ts'
import type { Catalog, CheckId, CheckStatus, Design, Difficulty } from './types.ts'

const vegetation = scenario('vegetation-monthly')

function check(patch: Partial<Design> = {}, difficulty: Difficulty = 'concept', sandbox = false, from: Catalog = catalog) {
  const { checks } = checkDesign({ ...referenceDesign(), ...patch }, vegetation, {
    catalog: from,
    difficulty,
    sandbox,
  })
  const status = (id: CheckId): CheckStatus | undefined => checks.find((entry) => entry.id === id)?.status
  const problems = checks.filter((entry) => entry.status !== 'ok').map((entry) => entry.id)
  return { checks, status, problems }
}

/** TEST FIXTURE, not real data: the catalogue with the 3U frame made far heavier. */
function catalogWithFrameMass(massKg: number): Catalog {
  return {
    ...catalog,
    components: catalog.components.map((entry) =>
      entry.id === 'structure-3u-isispace' ? { ...entry, mass_kg: massKg, max_mass_kg: 1000 } : entry,
    ),
  }
}

describe('pre-launch checks', () => {
  it('passes the reference design at every difficulty', () => {
    for (const difficulty of ['concept', 'trade-study', 'point-design'] as const) {
      expect(check({}, difficulty).problems, difficulty).toEqual([])
    }
  })

  it('blocks an unfinished design and names what is missing', () => {
    const { checks, status } = check({ orbitId: null, computerId: null })
    expect(status('design_incomplete')).toBe('blocked')
    expect(checks[0].values.missing).toBe('orbit,computer')
    expect(isBlocked(checks)).toBe(true)
  })

  it('blocks a part that is not in the catalogue', () => {
    expect(check({ batteryId: 'made-up' }).status('unknown_part')).toBe('blocked')
  })

  it('blocks a launcher that does not fly to the orbit', () => {
    expect(check({ orbitId: 'landsat-705' }).status('orbit_not_served')).toBe('blocked')
    expect(check({ orbitId: 'landsat-705', launcherId: 'electron' }, 'concept', true).status('orbit_not_served')).toBe('ok')
  })

  it('compares launch mass with the published launcher capacity', () => {
    // Rocket Lab publishes 200 kg to a 500 km Sun-synchronous orbit for Electron.
    const light = check({ launcherId: 'electron' })
    expect(light.checks.find((entry) => entry.id === 'launch_mass')?.values.capacityKg).toBe(200)
    expect(light.status('launch_mass')).toBe('ok')

    const heavy = catalogWithFrameMass(250)
    expect(check({ launcherId: 'electron' }, 'concept', false, heavy).status('launch_mass')).toBe('blocked')
  })

  it('asks for a bigger mass margin at higher difficulty', () => {
    const nearLimit = catalogWithFrameMass(186) // about 189.5 kg in all
    const at = (difficulty: Difficulty) =>
      check({ launcherId: 'electron' }, difficulty, false, nearLimit).status('launch_mass')
    expect(at('concept')).toBe('ok')
    expect(at('trade-study')).toBe('blocked')
  })

  it('blocks a spacecraft heavier than its CubeSat standard allows', () => {
    const tooHeavy: Catalog = {
      ...catalogWithFrameMass(5),
      components: catalogWithFrameMass(5).components.map((entry) =>
        entry.id === 'structure-3u-isispace' ? { ...entry, max_mass_kg: 6 } : entry,
      ),
    }
    expect(check({}, 'concept', false, tooHeavy).status('cubesat_mass')).toBe('blocked')
  })

  it('blocks parts made for another structure size', () => {
    const { status, checks } = check({ solarArrayId: 'solar-deployable-6u-endurosat' })
    expect(status('part_fit')).toBe('blocked')
    expect(checks.find((entry) => entry.id === 'part_fit')?.values.parts).toContain('6U')
  })

  it('blocks more instruments than the structure has room for', () => {
    const all = ['imager-multiscape50', 'imager-multiscape100', 'imager-gecko']
    expect(check({ instrumentIds: all }).status('instrument_volume')).toBe('blocked')
  })

  it('blocks a mission over budget', () => {
    expect(check({ launcherId: 'electron' }).status('budget')).toBe('blocked')
  })

  it('only warns in sandbox mode', () => {
    const { status, checks } = check({ launcherId: 'electron' }, 'concept', true)
    expect(status('budget')).toBe('risk')
    expect(isBlocked(checks)).toBe(false)
    // An unfinished design still cannot fly.
    expect(isBlocked(check({ launcherId: null }, 'concept', true).checks)).toBe(true)
  })

  it('flags missing subsystems as risks, not blockers', () => {
    const bare = check({
      solarArrayId: null,
      batteryId: null,
      attitudeControlId: null,
      radioIds: [],
      instrumentIds: [],
      groundStations: [],
    })
    for (const id of ['solar_array', 'battery', 'radio', 'pointing', 'instrument', 'ground_station', 'power'] as const) {
      expect(bare.status(id), id).toBe('risk')
    }
    expect(isBlocked(bare.checks)).toBe(false)
  })

  it('flags ground-segment problems', () => {
    expect(check({ radioIds: ['radio-uhf-endurosat'] }).problems).toEqual(['station_link', 'command_link'])
    expect(check({ radioIds: ['radio-xband-endurosat'] }).problems).toEqual(['command_link'])
    expect(
      check({ groundStations: [{ stationId: 'station-svalbard', passesPerDay: 30 }] }).problems,
    ).toEqual(['station_passes'])
  })

  it('flags power, data and lifetime shortfalls', () => {
    expect(check({ solarArrayId: 'solar-panel-3u-endurosat' }).problems).toEqual(['power'])
    expect(check({ radioIds: ['radio-sband-endurosat'] }).problems).toEqual(['data_downlink'])
    expect(check({ propulsionId: null }).problems).toEqual(['orbit_lifetime'])
  })
})
