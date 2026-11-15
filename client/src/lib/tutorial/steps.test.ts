import { describe, expect, it } from 'vitest'
import { elsewhere, settle, TUTORIAL_STEPS } from './steps.ts'
import type { TutorialState } from './steps.ts'

const start: TutorialState = { phase: 'need', orbitChosen: false, designBuilt: false, launched: false }
const index = (id: string) => TUTORIAL_STEPS.findIndex((step) => step.id === id)

describe('tutorial steps', () => {
  it('waits on steps that only explain', () => {
    expect(settle(0, start)).toBe(0)
    expect(settle(index('bars'), start)).toBe(index('bars'))
  })

  it('waits until the player does what a step asks', () => {
    expect(settle(index('need'), start)).toBe(index('need'))
    expect(settle(index('need'), { ...start, phase: 'concept' })).toBe(index('orbit'))
    expect(settle(index('orbit'), { ...start, phase: 'concept', orbitChosen: true })).toBe(index('requirements'))
  })

  it('skips steps the player has already done', () => {
    const built: TutorialState = { phase: 'design', orbitChosen: true, designBuilt: true, launched: false }
    expect(settle(index('need'), built)).toBe(index('builder'))
    const flown: TutorialState = { ...built, phase: 'operate', launched: true }
    expect(settle(index('launch'), flown)).toBe(index('playback'))
    expect(settle(index('builder'), { ...built, phase: 'verify' })).toBe(index('launch'))
  })

  it('never moves past the last step, nor before the first', () => {
    const flown: TutorialState = { phase: 'operate', orbitChosen: true, designBuilt: true, launched: true }
    expect(settle(TUTORIAL_STEPS.length + 3, flown)).toBe(TUTORIAL_STEPS.length - 1)
    expect(settle(-2, start)).toBe(0)
  })

  it('takes the player through every game step in order', () => {
    const order = ['need', 'concept', 'requirements', 'design', 'verify', 'operate']
    const phases = TUTORIAL_STEPS.map((step) => step.phase).filter((phase) => phase !== null)
    expect([...new Set(phases)]).toEqual(order)
  })

  it('says when a step is in another game step', () => {
    expect(elsewhere(TUTORIAL_STEPS[index('orbit')], 'need')).toBe(true)
    expect(elsewhere(TUTORIAL_STEPS[index('orbit')], 'concept')).toBe(false)
    expect(elsewhere(TUTORIAL_STEPS[index('welcome')], 'operate')).toBe(false)
  })

  it('has unique ids', () => {
    expect(new Set(TUTORIAL_STEPS.map((step) => step.id)).size).toBe(TUTORIAL_STEPS.length)
  })
})
