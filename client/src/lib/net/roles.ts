// Who looks after what in a team. Pure. The server enforces the same table
// (PATH_ROLES in server/app/models.py); this copy lets the screens grey out
// what a player may not change, and say whose choice it is.

import type { CheckId } from '../sim/types.ts'
import type { Role, RoomPlayer } from './messages.ts'

/** Every part of the room state a player can change, and the role that owns it. */
export const PATH_ROLES = {
  scenarioId: 'planner',
  difficulty: 'planner',
  sandbox: 'planner',
  'design.orbitId': 'planner',
  'design.structureId': 'engineer',
  'design.solarArrayId': 'engineer',
  'design.batteryId': 'engineer',
  'design.computerId': 'engineer',
  'design.attitudeControlId': 'engineer',
  'design.propulsionId': 'engineer',
  'design.instrumentIds': 'science',
  'design.imagingMinutesPerDay': 'science',
  'design.radioIds': 'comms',
  'design.groundStations': 'comms',
  'design.launcherId': 'comms',
} as const satisfies Record<string, Role>

export type RoomPath = keyof typeof PATH_ROLES
export const ROOM_PATHS = Object.keys(PATH_ROLES) as RoomPath[]

/** The player who holds a role. With fewer than four players, roles are merged. */
export function holderOf(role: Role, players: RoomPlayer[]): RoomPlayer | undefined {
  return players.find((player) => player.roles.includes(role))
}

export function canEdit(path: RoomPath, playerId: string, players: RoomPlayer[]): boolean {
  return holderOf(PATH_ROLES[path], players)?.id === playerId
}

/**
 * The roles whose choices decide each pre-launch check. A check with more
 * than one role is where a team has to negotiate: one role's choice can break
 * another's budget.
 */
export const CHECK_ROLES: Record<CheckId, Role[]> = {
  design_incomplete: ['planner', 'engineer', 'comms'],
  unknown_part: ['planner', 'engineer', 'science', 'comms'],
  orbit_not_served: ['planner', 'comms'],
  launch_mass: ['engineer', 'science', 'comms'],
  cubesat_mass: ['engineer', 'science', 'comms'],
  part_fit: ['engineer', 'science', 'comms'],
  instrument_volume: ['science', 'engineer'],
  budget: ['comms', 'engineer', 'science'],
  solar_array: ['engineer'],
  battery: ['engineer'],
  radio: ['comms'],
  pointing: ['engineer'],
  instrument: ['science'],
  ground_station: ['comms'],
  station_link: ['comms'],
  station_passes: ['comms', 'planner'],
  command_link: ['comms'],
  power: ['engineer', 'science', 'comms'],
  battery_depth: ['engineer'],
  data_downlink: ['science', 'comms'],
  orbit_lifetime: ['planner', 'engineer'],
}

/**
 * The teamwork part of the score, 0 to 1: the share of the team that changed
 * the mission at least once. A game-design value (docs/model-assumptions.md).
 * A team of one has no teamwork score.
 */
export function collaboration(players: number, contributors: number): number | undefined {
  if (players <= 1) return undefined
  return Math.min(1, Math.max(0, contributors / players))
}
