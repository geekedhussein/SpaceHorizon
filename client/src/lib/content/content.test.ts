// Validates the game data in /content against the schemas in /content/schemas,
// and checks the links between files. Runs in Node, so it reads the files directly.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'

const repoRoot = new URL('../../../../', import.meta.url)

function readText(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, repoRoot)), 'utf8')
}

function readJson(path: string): unknown {
  return JSON.parse(readText(path))
}

type Entry = Record<string, unknown> & { id: string }

const FILES = [
  'components',
  'instruments',
  'launchers',
  'orbits',
  'scenarios',
  'ground_stations',
  'ready_designs',
] as const
type FileName = (typeof FILES)[number]

const content = Object.fromEntries(
  FILES.map((name) => [name, readJson(`content/${name}.json`) as Entry[]]),
) as Record<FileName, Entry[]>

// A real calendar date written as YYYY-MM-DD.
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

const ajv = new Ajv2020({ allErrors: true })
ajv.addFormat('date', isIsoDate)
ajv.addSchema(readJson('content/schemas/common.schema.json') as object)
const validators = Object.fromEntries(
  FILES.map((name) => [name, ajv.compile(readJson(`content/schemas/${name}.schema.json`) as object)]),
) as Record<FileName, ReturnType<typeof ajv.compile>>

function errorsFor(name: FileName, data: unknown): string {
  const validate = validators[name]
  return validate(data) ? '' : ajv.errorsText(validate.errors, { separator: '\n' })
}

describe.each(FILES)('content/%s.json', (name) => {
  it('matches its schema', () => {
    expect(errorsFor(name, content[name])).toBe('')
  })

  it('is rejected when an entry has no source', () => {
    const { source: _source, ...withoutSource } = content[name][0]
    expect(errorsFor(name, [withoutSource])).toContain("required property 'source'")
  })

  it('is rejected when an entry has no retrieved date', () => {
    const { retrieved: _retrieved, ...withoutDate } = content[name][0]
    expect(errorsFor(name, [withoutDate])).toContain("required property 'retrieved'")
  })

  it('is rejected when an estimated entry has no estimate_basis', () => {
    const { estimate_basis: _basis, ...entry } = content[name][0]
    expect(errorsFor(name, [{ ...entry, estimated: true }])).toContain(
      "required property 'estimate_basis'",
    )
  })

  it('is rejected when an entry has a misspelled field', () => {
    expect(errorsFor(name, [{ ...content[name][0], sorce: 'typo' }])).not.toBe('')
  })

  it('has unique ids', () => {
    const ids = content[name].map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('links between content files', () => {
  const orbitIds = content.orbits.map((orbit) => orbit.id).sort()

  it('components and instruments do not share an id', () => {
    const ids = [...content.components, ...content.instruments].map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every launcher lists a capacity for exactly the orbits in orbits.json', () => {
    for (const launcher of content.launchers) {
      const capacity = launcher.capacity_kg_by_orbit as Record<string, number | null>
      expect(Object.keys(capacity).sort(), launcher.id).toEqual(orbitIds)
    }
  })

  it('every orbit can be reached by at least one launcher', () => {
    for (const orbitId of orbitIds) {
      const reachable = content.launchers.some(
        (launcher) => (launcher.capacity_kg_by_orbit as Record<string, number | null>)[orbitId] !== null,
      )
      expect(reachable, orbitId).toBe(true)
    }
  })

  it('no launcher has more successes than launches', () => {
    for (const launcher of content.launchers) {
      expect(launcher.launch_successes as number, launcher.id).toBeLessThanOrEqual(
        launcher.launch_attempts as number,
      )
    }
  })

  it('every instrument objective belongs to a scenario', () => {
    const objectiveIds = content.scenarios.map((scenario) => scenario.objective_id)
    for (const instrument of content.instruments) {
      for (const objective of instrument.compatible_objectives as string[]) {
        expect(objectiveIds, instrument.id).toContain(objective)
      }
    }
  })

  it('every scenario objective is served by at least one instrument', () => {
    for (const scenario of content.scenarios) {
      const served = content.instruments.some((instrument) =>
        (instrument.compatible_objectives as string[]).includes(scenario.objective_id as string),
      )
      expect(served, scenario.id).toBe(true)
    }
  })

  it('every ground station lists its receive bands from low to high', () => {
    for (const station of content.ground_stations) {
      for (const band of ['s_band', 'x_band']) {
        const min = station[`${band}_rx_min_mhz`] as number | undefined
        const max = station[`${band}_rx_max_mhz`] as number | undefined
        if (min !== undefined && max !== undefined) expect(min, station.id).toBeLessThan(max)
      }
    }
  })

  it('at least one ground station can hear a two-way radio', () => {
    // Without one, no design could receive commands.
    const radios = content.components.filter(
      (part) => part.category === 'communications' && part.two_way === true,
    )
    const heard = radios.some((radio) =>
      content.ground_stations.some((station) =>
        ['s_band', 'x_band'].some(
          (band) =>
            (radio.frequency_mhz as number) >= (station[`${band}_rx_min_mhz`] as number) &&
            (radio.frequency_mhz as number) <= (station[`${band}_rx_max_mhz`] as number),
        ),
      ),
    )
    expect(heard).toBe(true)
  })

  it('every ready-made design is for a scenario in scenarios.json', () => {
    const scenarioIds = content.scenarios.map((scenario) => scenario.id)
    for (const ready of content.ready_designs) expect(scenarioIds, ready.id).toContain(ready.scenario_id)
  })

  it('an instrument that serves no objective says why', () => {
    for (const instrument of content.instruments) {
      if ((instrument.compatible_objectives as string[]).length === 0) {
        expect(instrument.limitation, instrument.id).toBeTypeOf('string')
      }
    }
  })
})

describe('docs/model-assumptions.md', () => {
  const assumptions = readText('docs/model-assumptions.md')

  it('lists every estimated content entry by id', () => {
    const missing = FILES.flatMap((name) => content[name])
      .filter((entry) => entry.estimated === true)
      .map((entry) => entry.id)
      .filter((id) => !assumptions.includes(`\`${id}\``))
    expect(missing).toEqual([])
  })
})
