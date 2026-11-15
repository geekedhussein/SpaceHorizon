// The single-player game state: where the player is, what they have chosen,
// and the last mission flown. Everything else (budgets, checks, forecast) is
// derived from it by the pure functions in /lib/sim.

import { catalog, scenarios } from '../content/index.ts'
import { checkDesign, isBlocked, simulate } from '../sim/index.ts'
import type { Design, Difficulty, SimulationResult } from '../sim/index.ts'

export const PHASES = ['need', 'concept', 'requirements', 'design', 'verify', 'operate'] as const
export type Phase = (typeof PHASES)[number]

export function emptyDesign(): Design {
  return {
    orbitId: null,
    launcherId: null,
    structureId: null,
    solarArrayId: null,
    batteryId: null,
    computerId: null,
    attitudeControlId: null,
    propulsionId: null,
    radioIds: [],
    instrumentIds: [],
    groundStations: [],
    imagingMinutesPerDay: 0,
  }
}

/** Remembered in this browser only: Point design is unlocked. */
const UNLOCK_KEY = 'space-horizon.point-design-unlocked'

function readUnlocked(): boolean {
  try {
    return localStorage.getItem(UNLOCK_KEY) === 'yes'
  } catch {
    return false
  }
}

/** A fresh seed for a solo launch. In a room the server issues the seed. */
function newSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}

class Game {
  phase = $state<Phase>('need')
  scenarioId = $state(scenarios[0].id)
  difficulty = $state<Difficulty>('concept')
  sandbox = $state(false)
  design = $state<Design>(emptyDesign())

  /** The last mission flown, and the design it flew with. */
  result = $state.raw<SimulationResult | null>(null)
  launchedDesign = $state.raw<Design | null>(null)
  pointDesignUnlocked = $state(readUnlocked())
  /** True right after the launch that unlocked Point design. */
  justUnlocked = $state(false)

  scenario = $derived(scenarios.find((entry) => entry.id === this.scenarioId) ?? scenarios[0])

  /** The design looked up in the catalogue, its budgets and its checks. */
  analysis = $derived(
    checkDesign(this.design, this.scenario, {
      catalog,
      difficulty: this.difficulty,
      sandbox: this.sandbox,
    }),
  )
  blocked = $derived(isBlocked(this.analysis.checks))

  /**
   * What the design would return if nothing goes wrong by chance: the same
   * simulation, with chance events off and no check stopping the launch.
   */
  forecast = $derived(
    simulate(this.design, this.scenario, 0, { catalog, difficulty: 'concept', sandbox: true }),
  )

  designChangedSinceLaunch = $derived(
    this.launchedDesign !== null && JSON.stringify(this.launchedDesign) !== JSON.stringify(this.design),
  )

  go(phase: Phase): void {
    if (phase === 'operate' && this.result === null) return
    this.phase = phase
  }

  step(by: 1 | -1): void {
    const next = PHASES[PHASES.indexOf(this.phase) + by]
    if (next) this.go(next)
  }

  launch(): void {
    const design = $state.snapshot(this.design)
    const result = simulate(design, this.scenario, newSeed(), {
      catalog,
      difficulty: this.difficulty,
      sandbox: this.sandbox,
    })
    this.result = result
    this.launchedDesign = design
    this.justUnlocked = false
    const passed =
      result.outcome.status === 'completed' && result.requirements.every((requirement) => requirement.met)
    if (passed && !this.sandbox && this.difficulty === 'trade-study' && !this.pointDesignUnlocked) {
      this.pointDesignUnlocked = true
      this.justUnlocked = true
      try {
        localStorage.setItem(UNLOCK_KEY, 'yes')
      } catch {
        // Private windows may refuse storage; the unlock then lasts this visit.
      }
    }
    this.phase = 'operate'
  }
}

export const game = new Game()
