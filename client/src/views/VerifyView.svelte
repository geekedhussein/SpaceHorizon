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
    <button
      type="button"
      class="primary go"
      class:armed={!game.blocked && (team === null || game.everyoneReady)}
      disabled={game.blocked || (team !== null && !game.everyoneReady)}
      onclick={() => game.launch()}
    >
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
    background: linear-gradient(180deg, rgba(12, 18, 32, 0.97), #0a0f1b);
    box-shadow: 0 -8px 18px rgba(0, 0, 0, 0.35);
  }
  .go {
    min-width: 9rem;
    font-size: 1.05rem;
  }
  /* Ready to fly: the launch button breathes. */
  .armed {
    animation: armed 1.6s ease-in-out infinite;
  }
  @keyframes armed {
    50% {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.5),
        0 2px 0 #1a6a93,
        0 0 30px rgba(63, 184, 245, 0.8);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .armed {
      animation: none;
    }
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
