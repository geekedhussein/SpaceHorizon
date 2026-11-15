// Room messages, as sent over the WebSocket. These mirror the Pydantic models
// in server/app/models.py; a unit test checks the role table against that file.

import type { Design, Difficulty } from '../sim/types.ts'
import type { Phase } from '../stores/phases.ts'

export type Role = 'planner' | 'engineer' | 'science' | 'comms'
export const ROLES: Role[] = ['planner', 'engineer', 'science', 'comms']

export interface RoomPlayer {
  id: string
  name: string
  roles: Role[]
  ready: boolean
  /** Changes this player has made to the mission. */
  changes: number
}

// --------------------------------------------------------- client to server ---

export type ClientMessage =
  | { type: 'join'; name: string; role?: Role; player_id?: string }
  | { type: 'patch'; path: string; value: unknown; base_rev: number }
  | { type: 'ready'; ready: boolean }
  | { type: 'phase'; phase: Phase }
  | { type: 'chat'; text: string }
  | { type: 'launch' }

// --------------------------------------------------------- server to client ---

export interface StateMessage {
  type: 'state'
  rev: number
  code: string
  phase: Phase
  scenarioId: string | null
  difficulty: Difficulty
  sandbox: boolean
  design: Design
  players: RoomPlayer[]
  /** The id the server knows this player by. */
  you: string
}

export type ServerMessage =
  | StateMessage
  | { type: 'patch'; path: string; value: unknown; rev: number; by: string }
  | { type: 'players'; players: RoomPlayer[] }
  | { type: 'chat'; by: string; name: string; text: string }
  | { type: 'launch'; seed: number; players: number; contributors: number }
  | { type: 'error'; code: string; message: string; path?: string; value?: unknown }
