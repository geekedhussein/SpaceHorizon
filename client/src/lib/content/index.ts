// Typed access to the game data in /content. Vite bundles the JSON at build
// time, so nothing is fetched while the game runs. Tests load the same files
// from disk instead (see /client/tests/content.ts).

import components from '../../../../content/components.json'
import groundStations from '../../../../content/ground_stations.json'
import instruments from '../../../../content/instruments.json'
import launchers from '../../../../content/launchers.json'
import orbits from '../../../../content/orbits.json'
import scenarioList from '../../../../content/scenarios.json'
import type { Catalog, Scenario } from '../sim/types.ts'

// The JSON is checked against /content/schemas in content.test.ts.
export const catalog = {
  components,
  instruments,
  launchers,
  orbits,
  groundStations,
} as unknown as Catalog

export const scenarios = scenarioList as unknown as Scenario[]
