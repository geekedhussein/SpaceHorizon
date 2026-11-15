<script lang="ts">
  // Step 5: every check before launch, then the launch itself.
  import CheckList from '../lib/components/CheckList.svelte'
  import RequirementList from '../lib/components/RequirementList.svelte'
  import { game } from '../lib/stores/game.svelte.ts'
  import { fillTemplate, uiText } from '../lib/strings/en.ts'

  const text = uiText.verify
  let checks = $derived(game.analysis.checks)
  let count = $derived({
    blocked: checks.filter((check) => check.status === 'blocked').length,
    risk: checks.filter((check) => check.status === 'risk').length,
    ok: checks.filter((check) => check.status === 'ok').length,
  })
</script>

<p>{text.intro}</p>
<p class="summary" role="status">{fillTemplate(text.summary, count)}</p>

<CheckList {checks} />

<h3>{uiText.requirements.forecastTitle}</h3>
<p class="note">{uiText.requirements.forecastNote}</p>
<RequirementList requirements={game.scenario.requirements} results={game.forecast.requirements} />

<div class="launch">
  <p role="status">{game.blocked ? text.launchBlocked : text.launchReady}</p>
  <div class="buttons">
    <button type="button" onclick={() => game.go('design')}>{text.changeDesign}</button>
    <button type="button" class="primary" disabled={game.blocked} onclick={() => game.launch()}>
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
