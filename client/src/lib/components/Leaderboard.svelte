<script lang="ts">
  // The top scores for this scenario and level, and a way to add the mission
  // just flown. The score was worked out in the browser; the server stores it.
  import { submitScore, topScores } from '../net/api.ts'
  import type { LeaderboardRow } from '../net/api.ts'
  import { game } from '../stores/game.svelte.ts'
  import { fillTemplate, formatNumber, uiText } from '../strings/en.ts'

  const text = uiText.leaderboard
  let rows = $state<LeaderboardRow[] | null>(null)
  let unavailable = $state(false)
  let sending = $state(false)
  /** Seed of the flight already sent, so one flight is ranked once. */
  let sentSeed = $state<number | null>(null)

  let result = $derived(game.result)
  let team = $derived(game.room && game.room.players.length > 1 ? game.room.players.map((player) => player.name) : null)
  let canSubmit = $derived(
    result !== null && !result.sandbox && result.outcome.status !== 'not_launched' && sentSeed !== result.seed,
  )

  async function refresh(scenarioId: string, difficulty: typeof game.difficulty) {
    try {
      rows = await topScores(scenarioId, difficulty)
      unavailable = false
    } catch {
      unavailable = true
    }
  }
  // Fetched when the report opens and when the scenario or level changes.
  $effect(() => {
    if (result) refresh(result.scenarioId, result.difficulty)
  })

  async function submit() {
    if (!result || !game.launchedDesign) return
    sending = true
    try {
      await submitScore({
        scenario_id: result.scenarioId,
        difficulty: result.difficulty,
        score: Math.round(result.score.total * 10) / 10,
        design: game.launchedDesign,
        seed: result.seed,
        names: team ?? [game.playerName.trim().slice(0, 24) || 'Player'],
      })
      sentSeed = result.seed
      await refresh(result.scenarioId, result.difficulty)
    } catch {
      unavailable = true
    }
    sending = false
  }
</script>

{#if result}
  <section class="board">
    <h3>{text.title}</h3>
    <p class="note">
      {fillTemplate(text.subtitle, { scenario: game.scenario.name, level: uiText.need.levels[result.difficulty].name })}
    </p>

    {#if unavailable}
      <p class="note" role="status">{text.unavailable}</p>
    {:else if rows && rows.length > 0}
      <table>
        <thead>
          <tr><th scope="col">{text.rank}</th><th scope="col">{text.names}</th><th scope="col" class="number">{text.score}</th></tr>
        </thead>
        <tbody>
          {#each rows as row, index (row.id)}
            <tr>
              <td>{index + 1}</td>
              <td>{row.names.join(', ')}</td>
              <td class="number">{formatNumber(row.score)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else if rows}
      <p class="note">{text.empty}</p>
    {/if}

    {#if result.sandbox}
      <p class="note">{text.sandboxNote}</p>
    {:else if result.outcome.status === 'not_launched'}
      <p class="note">{text.notFlownNote}</p>
    {:else if sentSeed === result.seed}
      <p class="note" role="status">{text.submitted}</p>
    {:else if !unavailable}
      <div class="row">
        {#if !team}
          <label class="field">
            <span>{text.nameLabel}</span>
            <input type="text" maxlength="24" autocomplete="nickname" bind:value={game.playerName} />
          </label>
        {/if}
        <button type="button" disabled={!canSubmit || sending} onclick={submit}>
          {sending ? text.submitting : text.submit}
        </button>
      </div>
    {/if}
  </section>
{/if}

<style>
  .board {
    display: grid;
    gap: 0.4rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  th,
  td {
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid #232c3f;
    text-align: left;
  }
  th {
    color: #a9b6cc;
    font-size: 0.75rem;
    font-weight: 400;
  }
  .number {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.5rem;
  }
  input {
    min-height: 2.5rem;
    padding: 0.3rem 0.6rem;
    border: 1px solid #3a4963;
    border-radius: 8px;
    background: #121a2b;
    color: inherit;
    font: inherit;
  }
</style>
