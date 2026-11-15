import { describe, expect, it } from 'vitest'
import { physicsTooltips } from './en.ts'

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
