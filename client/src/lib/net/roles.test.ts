import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { RoomPlayer } from './messages.ts'
import { ROLES } from './messages.ts'
import { canEdit, CHECK_ROLES, collaboration, holderOf, PATH_ROLES, ROOM_PATHS } from './roles.ts'

const player = (id: string, roles: RoomPlayer['roles']): RoomPlayer => ({ id, name: id, roles, ready: false, changes: 0 })

describe('team roles', () => {
  it('matches the table the server enforces', () => {
    const python = readFileSync(new URL('../../../../server/app/models.py', import.meta.url), 'utf8')
    const table = python.slice(python.indexOf('PATH_ROLES: dict'), python.indexOf('_SETUP_VALUES'))
    const server = Object.fromEntries(
      [...table.matchAll(/"([\w.]+)": "(planner|engineer|science|comms)"/g)].map((match) => [match[1], match[2]]),
    )
    expect(server).toEqual(PATH_ROLES)
  })

  it('gives every role something to look after', () => {
    expect(new Set(Object.values(PATH_ROLES))).toEqual(new Set(ROLES))
    expect(ROOM_PATHS).toHaveLength(15)
  })

  it('lets only the holder of a role change its part', () => {
    const team = [player('ada', ['planner', 'science']), player('ben', ['engineer', 'comms'])]
    expect(holderOf('science', team)?.id).toBe('ada')
    expect(canEdit('design.orbitId', 'ada', team)).toBe(true)
    expect(canEdit('design.orbitId', 'ben', team)).toBe(false)
    expect(canEdit('design.launcherId', 'ben', team)).toBe(true)
    // A role nobody holds (an empty room) can be changed by nobody.
    expect(canEdit('design.orbitId', 'ada', [])).toBe(false)
  })

  it('names at least one role for every check', () => {
    for (const [check, roles] of Object.entries(CHECK_ROLES)) {
      expect(roles.length, check).toBeGreaterThan(0)
      expect(new Set(roles).size, check).toBe(roles.length)
    }
  })

  it('scores teamwork as the share of the team that took part', () => {
    expect(collaboration(1, 1)).toBeUndefined()
    expect(collaboration(4, 4)).toBe(1)
    expect(collaboration(4, 1)).toBe(0.25)
    expect(collaboration(2, 0)).toBe(0)
  })
})
