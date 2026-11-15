<script lang="ts">
  // The game shell: the mission steps across the top, the resource bars always
  // on screen, the current step's panel, and the 3D picture beside it.
  import BuilderView from './lib/components/BuilderView.svelte'
  import OrbitView from './lib/components/OrbitView.svelte'
  import PhaseNav from './lib/components/PhaseNav.svelte'
  import ResourceBars from './lib/components/ResourceBars.svelte'
  import { resourceBars } from './lib/components/resourceBars.ts'
  import { STEP_S } from './lib/sim/index.ts'
  import { game, PHASES } from './lib/stores/game.svelte.ts'
  import { uiText } from './lib/strings/en.ts'
  import ConceptView from './views/ConceptView.svelte'
  import DesignView from './views/DesignView.svelte'
  import NeedView from './views/NeedView.svelte'
  import OperateView from './views/OperateView.svelte'
  import RequirementsView from './views/RequirementsView.svelte'
  import VerifyView from './views/VerifyView.svelte'

  let bars = $derived(resourceBars(game.analysis.resolved, game.analysis.budgets, game.scenario, game.difficulty))

  /** Which picture is shown. The Design step starts on the spacecraft. */
  let picture = $state<'spacecraft' | 'orbit'>('orbit')
  $effect(() => {
    picture = game.phase === 'design' ? 'spacecraft' : 'orbit'
  })

  // The orbit view's clock lives here so it survives a switch of picture, and
  // so the mission timeline can move it.
  let orbitTimeS = $state(0)
  let orbitPlaying = $state(true)
  let bookedStationIds = $derived(game.design.groundStations.map((booking) => booking.stationId))

  let phaseIndex = $derived(PHASES.indexOf(game.phase))
  let panel: HTMLElement
  $effect(() => {
    void game.phase
    panel?.scrollTo({ top: 0 })
  })
</script>

<a class="skip" href="#panel">{uiText.skipToContent}</a>
<div class="app">
  <header>
    <h1>{uiText.appName}</h1>
    <PhaseNav phase={game.phase} canOperate={game.result !== null} onselect={(phase) => game.go(phase)} />
    <span class="level">{uiText.need.levels[game.difficulty].name}</span>
  </header>

  <ResourceBars {bars} />

  <div class="work">
    <main id="panel" class="game-panel" bind:this={panel} tabindex="-1">
      <p class="step">{phaseIndex + 1} / {PHASES.length} · {uiText.phases[game.phase].step}</p>
      <h2>{uiText.phases[game.phase].title}</h2>

      {#if game.phase === 'need'}<NeedView />
      {:else if game.phase === 'concept'}<ConceptView />
      {:else if game.phase === 'requirements'}<RequirementsView />
      {:else if game.phase === 'design'}<DesignView />
      {:else if game.phase === 'verify'}<VerifyView />
      {:else}<OperateView onday={(day) => (orbitTimeS = (day - 1) * STEP_S)} />
      {/if}

      {#if game.phase !== 'verify' && game.phase !== 'operate'}
        <div class="buttons">
          <button type="button" disabled={phaseIndex === 0} onclick={() => game.step(-1)}>{uiText.back}</button>
          <button type="button" class="primary" onclick={() => game.step(1)}>{uiText.next}</button>
        </div>
      {/if}
    </main>

    <section class="stage" aria-label={uiText.stage.label}>
      <div class="switch" role="group" aria-label={uiText.stage.label}>
        <button type="button" aria-pressed={picture === 'spacecraft'} onclick={() => (picture = 'spacecraft')}>
          {uiText.stage.spacecraft}
        </button>
        <button type="button" aria-pressed={picture === 'orbit'} onclick={() => (picture = 'orbit')}>
          {uiText.stage.orbit}
        </button>
      </div>
      {#if picture === 'spacecraft'}
        <BuilderView resolved={game.analysis.resolved} />
      {:else}
        <OrbitView orbitId={game.design.orbitId} {bookedStationIds} bind:tS={orbitTimeS} bind:playing={orbitPlaying} />
      {/if}
    </section>
  </div>
</div>

<style>
  .app {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    height: 100dvh;
  }
  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.4rem 0.75rem;
    background: #0b101c;
    border-bottom: 1px solid #1f2a40;
  }
  h1 {
    margin: 0;
    font-size: 1rem;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }
  header :global(nav) {
    flex: 1;
    min-width: 0;
  }
  .level {
    padding: 0.1rem 0.6rem;
    border: 1px solid #3a4963;
    border-radius: 999px;
    color: #c3cbd9;
    font-size: 0.75rem;
    white-space: nowrap;
  }
  .work {
    display: grid;
    grid-template-columns: minmax(22rem, 30rem) minmax(0, 1fr);
    min-height: 0;
  }
  main {
    display: grid;
    align-content: start;
    gap: 0.9rem;
    padding: 1rem;
    overflow-y: auto;
    border-right: 1px solid #1f2a40;
    background: #0b101c;
  }
  main:focus {
    outline: none;
  }
  .step {
    margin: 0 0 -0.6rem;
    color: #a9b6cc;
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  .buttons {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .stage {
    position: relative;
    min-width: 0;
    min-height: 0;
  }
  .switch {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 2;
    display: flex;
    border: 1px solid #3a4963;
    border-radius: 8px;
    overflow: hidden;
  }
  .switch button {
    border: 0;
    border-radius: 0;
    background: rgba(8, 12, 22, 0.82);
  }
  .switch button[aria-pressed='true'] {
    background: #7fd4ff;
    color: #05070d;
    font-weight: 600;
  }
  .skip {
    position: absolute;
    left: -999rem;
  }
  .skip:focus {
    left: 0.5rem;
    top: 0.5rem;
    z-index: 10;
    padding: 0.4rem 0.7rem;
    border-radius: 6px;
    background: #7fd4ff;
    color: #05070d;
  }

  /* Phone: the bars stay on top, the picture sits above the panel. */
  @media (max-width: 900px) {
    .app {
      display: block;
      height: auto;
    }
    header {
      flex-wrap: wrap;
      gap: 0.25rem 0.5rem;
    }
    header :global(nav) {
      flex-basis: 100%;
    }
    .level {
      display: none;
    }
    .app > :global(.bars) {
      position: sticky;
      top: 0;
      z-index: 5;
    }
    .work {
      display: flex;
      flex-direction: column;
    }
    .stage {
      order: -1;
      height: 44dvh;
    }
    main {
      overflow: visible;
      border-right: 0;
    }
  }
</style>
