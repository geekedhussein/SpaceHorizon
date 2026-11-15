import { describe, expect, it } from 'vitest'
import { designIdFromLink } from './designLink.ts'

describe('saved design links', () => {
  it('reads the id from the page address', () => {
    expect(designIdFromLink('#design=aB3_x-9Q')).toBe('aB3_x-9Q')
  })

  it('ignores anything that is not a saved design id', () => {
    for (const hash of ['', '#', '#design=', '#other=abc', '#design=a/b', '#design=<script>', `#design=${'x'.repeat(65)}`]) {
      expect(designIdFromLink(hash), hash).toBeNull()
    }
  })
})
