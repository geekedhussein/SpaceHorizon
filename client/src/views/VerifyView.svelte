<script lang="ts">
  // Step 5: every check before launch, then the launch itself.
  import CheckList from '../lib/components/CheckList.svelte'
  import RequirementList from '../lib/components/RequirementList.svelte'
  import SaveShare from '../lib/components/SaveShare.svelte'
  import { game } from '../lib/stores/game.svelte.ts'
  import { fillTemplate, uiText } from '../lib/strings/en.ts'

  const text = uiText.verify
  let checks = $derived(game.analysis.checks)
  let team = $derived(game.room)
  let waiting = $derived(team ? team.players.filter((player) => !player.ready).map((player) => player.name) : [])
  let count = $derived({
    blocked: checks.filter((check) => check.status === 'blocked').length,
    risk: checks.filter((check) => check.status === 'risk').length,
    ok: checks.filter((check) => check.status === 'ok').length,
  })
</script>

<p>{text.intro}</p>
<p class="summary" role="status">{fillTemplate(text.summary, count)}</p>

<CheckList {checks} players={team?.players} />

<h3>{uiText.requirements.forecastTitle}</h3>
<p class="note">{uiText.requirements.forecastNote}</p>
<RequirementList requirements={game.scenario.requirements} results={game.forecast.requirements} />

<SaveShare />

<div class="launch" data-tour="launch">
  <p role="status">
    {#if game.blocked}
      {text.launchBlocked}
    {:else if team && waiting.length > 0}
      {fillTemplate(uiText.team.waitingFor, { names: waiting.join(', ') })}
      {uiText.team.readyHelp}
    {:else if team}
      {uiText.team.allReady}
    {:else}
      {text.launchReady}
    {/if}
  </p>
  <div class="buttons">
    <button type="button" onclick={() => game.go('design')}>{text.changeDesign}</button>
    {#if team}
      <button type="button" aria-pressed={game.me?.ready ?? false} disabled={game.blocked} onclick={() => game.setReady(!game.me?.ready)}>
        <span aria-hidden="true">{game.me?.ready ? '✓' : '○'}</span>
        {game.me?.ready ? uiText.team.notReadyButton : uiText.team.readyButton}
      </button>
    {/if}
    <button type="button" class="primary" disabled={game.blocked || (team !== null && !game.everyoneReady)} onclick={() => game.launch()}>
      <span aria-hidden="true">▲</span>
      {text.launch}
    </button>
  </div>
</div>

<style>
  .summary {
    font-weight: 600;
  }
  .launch {
    position: sticky;
    bottom: -1rem;
    margin: 0 -1rem -1rem;
    padding: 0.6rem 1rem 0.9rem;
    border-top: 1px solid #2a3650;
    background: #0b101c;
  }
  .launch p {
    margin: 0 0 0.5rem;
    font-size: 0.875rem;
  }
  .buttons {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
  }
</style>
