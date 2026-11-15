// Test support: load the real game data from /content. Runs in Node only, so
// it lives outside /src and is never part of the client bundle.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Catalog, Design, Scenario } from '../src/lib/sim/types.ts'

const contentDir = new URL('../../content/', import.meta.url)

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`${name}.json`, contentDir)), 'utf8')) as T
}

export const catalog: Catalog = {
  components: readJson('components'),
  instruments: readJson('instruments'),
  launchers: readJson('launchers'),
  orbits: readJson('orbits'),
  groundStations: readJson('ground_stations'),
}

export const scenarios = readJson<Scenario[]>('scenarios')

export function scenario(id: string): Scenario {
  const found = scenarios.find((entry) => entry.id === id)
  if (!found) throw new Error(`No scenario ${id} in /content`)
  return found
}

/**
 * A design that meets every requirement of the vegetation scenario: a 3U
 * CubeSat with deployable arrays, S-band for commands, X-band for pictures,
 * an ion thruster against drag, and Svalbard as its ground station.
 */
export function referenceDesign(): Design {
  return {
    orbitId: 'sso-500',
    launcherId: 'falcon9-rideshare',
    structureId: 'structure-3u-isispace',
    solarArrayId: 'solar-deployable-3u-endurosat',
    batteryId: 'battery-36wh-orbastro',
    computerId: 'computer-endurosat-obc',
    attitudeControlId: 'adcs-tensortech-mtq',
    propulsionId: 'thruster-enpulsion-nano',
    radioIds: ['radio-sband-endurosat', 'radio-xband-endurosat'],
    instrumentIds: ['imager-multiscape50'],
    groundStations: [{ stationId: 'station-svalbard', passesPerDay: 10.5 }],
    imagingMinutesPerDay: 98,
  }
}
