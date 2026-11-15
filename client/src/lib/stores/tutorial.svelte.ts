// Whether the tutorial is running, and which step it is on. It starts by
// itself on a player's first visit and can be started again at any time.

import { settle, TUTORIAL_STEPS } from '../tutorial/steps.ts'
import type { TutorialState } from '../tutorial/steps.ts'
import { game, store, stored } from './game.svelte.ts'

const DONE_KEY = 'space-horizon.tutorial-done'

class Tutorial {
  active = $state(false)
  /** Shrunk to a small button, so it does not cover the game. */
  hidden = $state(false)
  index = $state(0)

  /** What the tutorial watches in the game. */
  state = $derived<TutorialState>({
    phase: game.phase,
    orbitChosen: game.design.orbitId !== null,
    designBuilt:
      game.design.structureId !== null &&
      game.design.launcherId !== null &&
      game.design.instrumentIds.length > 0 &&
      game.design.groundStations.length > 0,
    launched: game.result !== null,
  })

  step = $derived(TUTORIAL_STEPS[this.index])
  isLast = $derived(this.index === TUTORIAL_STEPS.length - 1)

  /** Start on a first visit. A saved-design link goes straight to the design. */
  startIfNew(): void {
    if (stored('localStorage', DONE_KEY) !== 'yes' && !location.hash) this.start()
  }

  start(): void {
    this.index = settle(0, this.state)
    this.hidden = false
    this.active = true
  }

  /** Move on to the first step the player has not already done. */
  settle(): void {
    this.index = settle(this.index, this.state)
  }

  next(): void {
    if (this.isLast) this.stop()
    else this.index = settle(this.index + 1, this.state)
  }

  back(): void {
    this.index = Math.max(0, this.index - 1)
  }

  stop(): void {
    this.active = false
    store('localStorage', DONE_KEY, 'yes')
  }
}

export const tutorial = new Tutorial()
