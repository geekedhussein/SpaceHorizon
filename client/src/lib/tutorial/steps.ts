// The first-run tutorial: one guided mission, from choosing it to reading the
// report. Pure data and logic, so it can be tested without a browser. The
// words for each step live in /lib/strings (uiText.tutorial).

import { PHASES } from '../stores/phases.ts'
import type { Phase } from '../stores/phases.ts'

/** What the tutorial needs to know about the game to move on by itself. */
export interface TutorialState {
  phase: Phase
  orbitChosen: boolean
  /** A frame, a launcher, an instrument and a ground station are chosen. */
  designBuilt: boolean
  launched: boolean
}

export type TutorialStepId =
  | 'welcome'
  | 'bars'
  | 'need'
  | 'orbit'
  | 'requirements'
  | 'design'
  | 'builder'
  | 'launch'
  | 'playback'
  | 'report'
  | 'loop'

export interface TutorialStep {
  id: TutorialStepId
  /** The game step this tutorial step takes place in, or null for anywhere. */
  phase: Phase | null
  /** The `data-tour` value of the part of the screen to point at. */
  target: string | null
  /**
   * When the player has done what the step asks. Steps without it only
   * explain, and move on when the player presses Next.
   */
  done?: (state: TutorialState) => boolean
}

const reached = (state: TutorialState, phase: Phase) => PHASES.indexOf(state.phase) >= PHASES.indexOf(phase)

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'welcome', phase: null, target: null },
  { id: 'bars', phase: null, target: 'bars' },
  { id: 'need', phase: 'need', target: 'level', done: (state) => reached(state, 'concept') },
  { id: 'orbit', phase: 'concept', target: 'orbits', done: (state) => state.orbitChosen },
  { id: 'requirements', phase: 'requirements', target: 'requirements', done: (state) => reached(state, 'design') },
  { id: 'design', phase: 'design', target: 'ready', done: (state) => state.designBuilt },
  { id: 'builder', phase: 'design', target: 'stage', done: (state) => reached(state, 'verify') },
  { id: 'launch', phase: 'verify', target: 'launch', done: (state) => state.launched },
  { id: 'playback', phase: 'operate', target: 'playback' },
  { id: 'report', phase: 'operate', target: 'score' },
  { id: 'loop', phase: null, target: null },
]

/**
 * The step to show: from `index`, skip every step the player has already
 * done, so doing things ahead of the tutorial never leaves it behind.
 */
export function settle(index: number, state: TutorialState, steps: readonly TutorialStep[] = TUTORIAL_STEPS): number {
  let at = Math.max(0, Math.min(index, steps.length - 1))
  while (at < steps.length - 1 && steps[at].done?.(state)) at++
  return at
}

/** True when the step happens in a game step other than the one on screen. */
export function elsewhere(step: TutorialStep, phase: Phase): boolean {
  return step.phase !== null && step.phase !== phase
}
