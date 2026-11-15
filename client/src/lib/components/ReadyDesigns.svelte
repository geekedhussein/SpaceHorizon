<script lang="ts">
  // Ready-made designs from /content/ready_designs.json, for players who would
  // rather start from a complete mission than pick every part.
  import { untrack } from 'svelte'
  import { catalog, readyDesigns } from '../content/index.ts'
  import { checkDesign, simulate } from '../sim/index.ts'
  import type { Design, ReadyDesign } from '../sim/index.ts'
  import { game } from '../stores/game.svelte.ts'
  import { describeCheck, fillTemplate, formatMoney, formatNumber, uiText } from '../strings/en.ts'

  const text = uiText.design.ready

  let options = $derived(readyDesigns.filter((ready) => ready.scenario_id === game.scenarioId))

  /** Checks at the current level, and the forecast, for each ready-made design. */
  let rated = $derived(
    options.map((ready) => {
      const { budgets, checks } = checkDesign(ready.design, game.scenario, {
        catalog,
        difficulty: game.difficulty,
        sandbox: game.sandbox,
      })
      const forecast = simulate(ready.design, game.scenario, 0, { catalog, difficulty: 'concept', sandbox: true })
      const failing = checks.filter((check) => check.status !== 'ok').map((check) => describeCheck(check).title)
      return { ready, budgets, failing, score: forecast.score.total }
    }),
  )

  const same = (a: Design, b: Design) =>
    (Object.keys(b) as (keyof Design)[]).every((key) => JSON.stringify(a[key]) === JSON.stringify(b[key]))

  // Open at first while nothing is chosen; after that the player decides.
  let open = $state(untrack(() => game.design.structureId === null && game.design.launcherId === null))
  let message = $state<string | null>(null)

  const orbitName = (id: string | null) => catalog.orbits.find((orbit) => orbit.id === id)?.name ?? ''
  const launcherName = (id: string | null) => catalog.launchers.find((launcher) => launcher.id === id)?.name ?? ''

  function use(ready: ReadyDesign) {
    const leftToOthers = game.useReadyDesign(ready)
    message = leftToOthers > 0 ? fillTemplate(text.teamPart, { count: leftToOthers }) : text.replaced
  }
</script>

{#if options.length > 0}
  <details class="ready" bind:open data-tour="ready">
    <summary>{text.title}</summary>
    <p class="note">{text.intro}</p>
    <ul>
      {#each rated as { ready, budgets, failing, score } (ready.id)}
        {@const inUse = same(game.design, ready.design)}
        <li class:inUse>
          <h4>{ready.name}</h4>
          <p>{ready.summary}</p>
          <p class="trade"><strong>{text.gives}</strong> {ready.trade_off}</p>
          <p class="facts">
            <span>{orbitName(ready.design.orbitId)}</span>
            <span>{fillTemplate(text.facts.launcher, { launcher: launcherName(ready.design.launcherId) })}</span>
            <span>
              {fillTemplate(text.facts.cost, {
                cost: formatMoney(budgets.cost.totalMusd),
                budget: formatMoney(game.scenario.budget_musd),
              })}
            </span>
            <span>{fillTemplate(text.facts.mass, { kg: formatNumber(budgets.massKg) })}</span>
            <span>{fillTemplate(text.facts.score, { points: Math.round(score) })}</span>
          </p>
          {#if game.design.orbitId !== null && game.design.orbitId !== ready.design.orbitId && !inUse}
            <p class="note">{fillTemplate(text.changesOrbit, { orbit: orbitName(ready.design.orbitId) })}</p>
          {/if}
          {#if failing.length > 0}
            <p class="note warn">{fillTemplate(text.failsHere, { checks: failing.join(', ') })}</p>
          {/if}
          {#if inUse}
            <p class="in-use"><span aria-hidden="true">✓</span> {text.inUse}</p>
          {:else}
            <button type="button" onclick={() => use(ready)}>{text.use}</button>
          {/if}
        </li>
      {/each}
    </ul>
    {#if message}<p class="note" role="status">{message}</p>{/if}
  </details>
{/if}

<style>
  .ready {
    padding: 0.6rem 0.8rem;
    border: 1px solid #2a3650;
    border-radius: 8px;
    background: #0f1626;
  }
  summary {
    cursor: pointer;
    font-weight: 600;
  }
  ul {
    display: grid;
    gap: 0.5rem;
    margin: 0.5rem 0 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: grid;
    gap: 0.3rem;
    padding: 0.6rem 0.7rem;
    border: 1px solid #2a3650;
    border-radius: 8px;
    background: #121a2b;
  }
  li.inUse {
    border-color: #7fd4ff;
    background: #13203a;
  }
  h4 {
    margin: 0;
    font-size: 0.9375rem;
  }
  p {
    margin: 0;
    font-size: 0.8125rem;
  }
  .trade {
    color: #c3cbd9;
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    color: #c3cbd9;
    font-variant-numeric: tabular-nums;
  }
  .warn {
    color: #fab219;
  }
  .in-use {
    color: #7fd4ff;
    font-weight: 600;
  }
  button {
    justify-self: start;
  }
</style>
