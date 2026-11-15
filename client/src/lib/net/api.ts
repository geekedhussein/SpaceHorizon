// The REST calls to the game server: saved designs and the leaderboard. Each is
// made once, when the player asks; nothing here polls.

import type { Design, Difficulty } from '../sim/types.ts'

export interface LeaderboardRow {
  id: number
  score: number
  names: string[]
  seed: number
  created_at: string
}

export interface ScoreSubmission {
  scenario_id: string
  difficulty: Difficulty
  score: number
  design: Design
  seed: number
  names: string[]
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`The server answered ${response.status}`)
  return (await response.json()) as T
}

function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

/** Save a design and get the id for its shareable link. */
export async function saveDesign(scenarioId: string, design: Design): Promise<string> {
  return (await json<{ id: string }>(await post('/api/designs', { scenario_id: scenarioId, design }))).id
}

export async function loadDesign(id: string): Promise<{ scenario_id: string; design: Design }> {
  return json(await fetch(`/api/designs/${encodeURIComponent(id)}`))
}

export async function submitScore(submission: ScoreSubmission): Promise<void> {
  await json(await post('/api/leaderboard', submission))
}

export async function topScores(scenarioId: string, difficulty: Difficulty): Promise<LeaderboardRow[]> {
  const query = new URLSearchParams({ scenario_id: scenarioId, difficulty })
  return (await json<{ rows: LeaderboardRow[] }>(await fetch(`/api/leaderboard?${query}`))).rows
}

/** The link that opens a saved design: the page address plus `#design=<id>`. */
export function designLink(id: string): string {
  return `${location.origin}${location.pathname}#design=${encodeURIComponent(id)}`
}
