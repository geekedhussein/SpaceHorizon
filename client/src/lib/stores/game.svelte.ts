// The game state: where the player is, what they have chosen, the last
// mission flown, and (in a team) the room. Everything else (budgets, checks,
// forecast) is derived from it by the pure functions in /lib/sim.
//
// Solo, the choices live only here. In a room the server holds them: local
// changes go out as patches, and other players' patches come in.

import { catalog, scenarios } from '../content/index.ts'
import { loadDesign } from '../net/api.ts'
import { designIdFromLink } from '../net/designLink.ts'
import type { RoomPlayer, ServerMessage } from '../net/messages.ts'
import { canEdit, collaboration, PATH_ROLES, ROOM_PATHS } from '../net/roles.ts'
import type { RoomPath } from '../net/roles.ts'
import { connectRoom, createRoom, roomExists } from '../net/roomClient.ts'
import type { ConnectionStatus, RoomConnection } from '../net/roomClient.ts'
import { checkDesign, isBlocked, simulate } from '../sim/index.ts'
import type { Design, Difficulty, ReadyDesign, SimulationResult } from '../sim/index.ts'
import { PHASES } from './phases.ts'
import type { Phase } from './phases.ts'

export { PHASES }
export type { Phase }

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

export interface ChatLine {
  by: string
  name: string
  text: string
}

export interface RoomState {
  code: string
  /** This player's id in the room. Empty until the server answers. */
  me: string
  players: RoomPlayer[]
  rev: number
  status: ConnectionStatus
  chat: ChatLine[]
  /** Chat lines that arrived while the team panel was closed. */
  unread: number
}

/** Remembered in this browser only. */
const UNLOCK_KEY = 'space-horizon.point-design-unlocked'
const NAME_KEY = 'space-horizon.player-name'
const PLAYER_ID_KEY = 'space-horizon.player-id'
const MAX_CHAT_LINES = 50
/** Local changes are gathered for this long before they are sent. */
const SEND_DELAY_MS = 120

function stored(storage: 'localStorage' | 'sessionStorage', key: string): string | null {
  try {
    return window[storage].getItem(key)
  } catch {
    return null
  }
}
function store(storage: 'localStorage' | 'sessionStorage', key: string, value: string): void {
  try {
    window[storage].setItem(key, value)
  } catch {
    // Private windows may refuse storage; the value then lasts this visit.
  }
}

/** A fresh seed for a solo launch. In a room the server issues the seed. */
function newSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}

/** An id for this visit, so a reconnect is recognised as the same player. */
function playerId(): string {
  let id = stored('sessionStorage', PLAYER_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    store('sessionStorage', PLAYER_ID_KEY, id)
  }
  return id
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
  pointDesignUnlocked = $state(stored('localStorage', UNLOCK_KEY) === 'yes')
  /** True right after the launch that unlocked Point design. */
  justUnlocked = $state(false)

  /** The team room, or null when playing alone. */
  room = $state<RoomState | null>(null)
  /** The last thing that went wrong in a room, as an error code. */
  roomError = $state<string | null>(null)
  playerName = $state(stored('localStorage', NAME_KEY) ?? '')
  /** Set after a saved design was opened from the page address: 'loaded' or 'failed'. */
  linkStatus = $state<'loaded' | 'failed' | null>(null)

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

  me = $derived(this.room?.players.find((player) => player.id === this.room?.me) ?? null)
  everyoneReady = $derived(
    this.room !== null && this.room.players.length > 0 && this.room.players.every((player) => player.ready),
  )

  #connection: RoomConnection | null = null
  /** For each room path, the value the server is known to hold, as JSON. */
  #synced: Partial<Record<RoomPath, string>> = {}
  #stopSync: (() => void) | null = null
  #sendTimer: ReturnType<typeof setTimeout> | undefined

  /** Open the saved design named in the page address, if there is one. */
  async openLinkedDesign(): Promise<void> {
    const id = designIdFromLink(location.hash)
    if (id === null) return
    try {
      const saved = await loadDesign(id)
      if (scenarios.some((entry) => entry.id === saved.scenario_id)) this.scenarioId = saved.scenario_id
      // Take only the fields a design has; anything missing stays empty.
      const design = emptyDesign()
      for (const key of Object.keys(design) as (keyof Design)[]) {
        if (saved.design[key] !== undefined) (design as unknown as Record<string, unknown>)[key] = saved.design[key]
      }
      this.design = design
      this.phase = 'design'
      this.linkStatus = 'loaded'
    } catch {
      this.linkStatus = 'failed'
    }
  }

  /**
   * Replace the design with a ready-made one. In a team, only the parts this
   * player's roles own change; returns how many parts were left to others.
   */
  useReadyDesign(ready: ReadyDesign): number {
    let leftToOthers = 0
    const target = this.design as unknown as Record<string, unknown>
    for (const [key, value] of Object.entries(ready.design)) {
      if (!this.canEdit(`design.${key}` as RoomPath)) {
        if (JSON.stringify(target[key]) !== JSON.stringify(value)) leftToOthers++
        continue
      }
      target[key] = structuredClone(value)
    }
    return leftToOthers
  }

  // ------------------------------------------------------------- steps ---

  go(phase: Phase): void {
    if (phase === 'operate' && this.result === null) return
    if (phase !== this.phase) this.#connection?.send({ type: 'phase', phase })
    this.phase = phase
  }

  step(by: 1 | -1): void {
    const next = PHASES[PHASES.indexOf(this.phase) + by]
    if (next) this.go(next)
  }

  /** Launch: at once when alone; in a room, ask the server, which tells everyone. */
  launch(): void {
    if (this.room) this.#connection?.send({ type: 'launch' })
    else this.#fly(newSeed(), undefined)
  }

  #fly(seed: number, teamwork: number | undefined): void {
    const design = $state.snapshot(this.design)
    const result = simulate(design, this.scenario, seed, {
      catalog,
      difficulty: this.difficulty,
      sandbox: this.sandbox,
      collaboration: teamwork,
    })
    this.result = result
    this.launchedDesign = design
    this.justUnlocked = false
    const passed =
      result.outcome.status === 'completed' && result.requirements.every((requirement) => requirement.met)
    if (passed && !this.sandbox && this.difficulty === 'trade-study' && !this.pointDesignUnlocked) {
      this.pointDesignUnlocked = true
      this.justUnlocked = true
      store('localStorage', UNLOCK_KEY, 'yes')
    }
    this.phase = 'operate'
  }

  // -------------------------------------------------------------- room ---

  /** True if this player may change that part of the mission. Always true alone. */
  canEdit(path: RoomPath): boolean {
    return this.room === null || canEdit(path, this.room.me, this.room.players)
  }

  /** The player who holds the role that owns a path, when it is not this player. */
  lockedBy(path: RoomPath): { role: (typeof PATH_ROLES)[RoomPath]; name: string } | null {
    if (this.canEdit(path) || !this.room) return null
    const role = PATH_ROLES[path]
    return { role, name: this.room.players.find((player) => player.roles.includes(role))?.name ?? '?' }
  }

  async createRoom(): Promise<void> {
    this.roomError = null
    try {
      const { code } = await createRoom()
      this.#enter(code)
    } catch (problem) {
      this.roomError = problem instanceof Error && problem.message === 'server_full' ? 'server_full' : 'offline'
    }
  }

  async joinRoom(code: string): Promise<void> {
    this.roomError = null
    const tidy = code.trim().toUpperCase()
    try {
      if (!(await roomExists(tidy))) this.roomError = 'room_not_found'
      else this.#enter(tidy)
    } catch {
      this.roomError = 'offline'
    }
  }

  leaveRoom(): void {
    // Forget the connection before closing it: closing reports back here.
    const connection = this.#connection
    this.#connection = null
    connection?.close()
    this.#stopSync?.()
    this.#stopSync = null
    clearTimeout(this.#sendTimer)
    this.#synced = {}
    this.room = null
  }

  setReady(ready: boolean): void {
    this.#connection?.send({ type: 'ready', ready })
  }

  chat(text: string): void {
    const tidy = text.trim().slice(0, 280)
    if (tidy) this.#connection?.send({ type: 'chat', text: tidy })
  }

  markChatRead(): void {
    if (this.room) this.room.unread = 0
  }

  #enter(code: string): void {
    this.leaveRoom()
    const name = this.playerName.trim().slice(0, 24) || 'Player'
    store('localStorage', NAME_KEY, name)
    this.room = { code, me: '', players: [], rev: 0, status: 'connecting', chat: [], unread: 0 }
    this.#connection = connectRoom(code, {
      join: () => ({ type: 'join', name, player_id: playerId() }),
      onmessage: (message) => this.#receive(message),
      onstatus: (status) => {
        if (this.room) this.room.status = status
        // The server turned this player away (room gone, full, or replaced).
        if (status === 'closed' && this.#connection !== null) this.leaveRoom()
      },
    })
    // Watch every part of the mission a room shares; send what changes.
    this.#stopSync = $effect.root(() => {
      $effect(() => {
        for (const path of ROOM_PATHS) JSON.stringify(this.#read(path))
        void this.room?.players
        clearTimeout(this.#sendTimer)
        this.#sendTimer = setTimeout(() => this.#sendChanges(), SEND_DELAY_MS)
      })
    })
  }

  #read(path: RoomPath): unknown {
    if (path === 'scenarioId' || path === 'difficulty' || path === 'sandbox') return this[path]
    return this.design[path.slice('design.'.length) as keyof Design]
  }

  #write(path: RoomPath, value: unknown): void {
    if (path === 'scenarioId') {
      // The room has no scenario until the planner picks one.
      if (typeof value === 'string') this.scenarioId = value
    } else if (path === 'difficulty') this.difficulty = value as Difficulty
    else if (path === 'sandbox') this.sandbox = value as boolean
    else (this.design as unknown as Record<string, unknown>)[path.slice('design.'.length)] = value
  }

  /** Send each local change this player may make; undo the ones they may not. */
  #sendChanges(): void {
    const room = this.room
    if (!room || room.status !== 'open' || room.me === '') return
    for (const path of ROOM_PATHS) {
      const local = JSON.stringify($state.snapshot(this.#read(path)))
      const known = this.#synced[path]
      if (known === undefined || local === known) continue
      if (this.canEdit(path)) {
        this.#synced[path] = local
        this.#connection?.send({ type: 'patch', path, value: JSON.parse(local), base_rev: room.rev })
      } else if (known !== 'null' || path !== 'scenarioId') {
        this.#write(path, JSON.parse(known))
      }
    }
  }

  #receive(message: ServerMessage): void {
    const room = this.room
    if (!room) return
    switch (message.type) {
      case 'state': {
        room.me = message.you
        room.players = message.players
        room.rev = message.rev
        const remote: Record<RoomPath, unknown> = {
          scenarioId: message.scenarioId,
          difficulty: message.difficulty,
          sandbox: message.sandbox,
          ...(Object.fromEntries(
            Object.entries(message.design).map(([key, value]) => [`design.${key}`, value]),
          ) as Record<Exclude<RoomPath, 'scenarioId' | 'difficulty' | 'sandbox'>, unknown>),
        }
        // A brand-new room takes its first player's mission. Otherwise the
        // room's mission replaces the local one.
        const founding = message.rev === 0 && message.players.length === 1
        for (const path of ROOM_PATHS) {
          this.#synced[path] = JSON.stringify(remote[path])
          if (!founding) this.#write(path, remote[path])
        }
        if (!founding && message.phase !== 'operate') this.phase = message.phase
        this.#sendChanges()
        break
      }
      case 'patch': {
        room.rev = message.rev
        if (message.by === room.me) break
        if (message.path === 'phase') {
          const phase = message.value as Phase
          if (phase !== 'operate' || this.result !== null) this.phase = phase
        } else if (message.path in PATH_ROLES) {
          const path = message.path as RoomPath
          this.#synced[path] = JSON.stringify(message.value)
          this.#write(path, message.value)
        }
        break
      }
      case 'players':
        room.players = message.players
        break
      case 'chat':
        room.chat = [...room.chat, { by: message.by, name: message.name, text: message.text }].slice(-MAX_CHAT_LINES)
        if (message.by !== room.me) room.unread++
        break
      case 'launch':
        this.#fly(message.seed, collaboration(message.players, message.contributors))
        break
      case 'error': {
        this.roomError = message.code
        if (message.path !== undefined && message.path in PATH_ROLES) {
          // The server refused a change: show what it holds instead.
          const path = message.path as RoomPath
          this.#synced[path] = JSON.stringify(message.value ?? null)
          this.#write(path, message.value ?? null)
        } else if (message.code === 'rate_limited') {
          // Some changes were dropped. Ask for the full state again.
          this.#connection?.send({ type: 'join', name: this.playerName.trim().slice(0, 24) || 'Player', player_id: playerId() })
        }
        break
      }
    }
  }
}

export const game = new Game()
