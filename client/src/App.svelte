<script lang="ts">
  import { onMount } from 'svelte'
  // The game shell: the mission steps across the top, the resource bars always
  // on screen, the current step's panel, and the 3D picture beside it.
  import BadgeShelf from './lib/components/BadgeShelf.svelte'
  import BuilderView from './lib/components/BuilderView.svelte'
  import LaunchCountdown from './lib/components/LaunchCountdown.svelte'
  import OrbitView from './lib/components/OrbitView.svelte'
  import PhaseNav from './lib/components/PhaseNav.svelte'
  import ResourceBars from './lib/components/ResourceBars.svelte'
  import SoundToggle from './lib/components/SoundToggle.svelte'
  import TeamPanel from './lib/components/TeamPanel.svelte'
  import TutorialCoach from './lib/components/TutorialCoach.svelte'
  import { resourceBars } from './lib/components/resourceBars.ts'
  import { STEP_S } from './lib/sim/index.ts'
  import { game, PHASES } from './lib/stores/game.svelte.ts'
  import { tutorial } from './lib/stores/tutorial.svelte.ts'
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

  // A link with "#design=<id>" opens that saved design.
  onMount(() => {
    game.openLinkedDesign()
    tutorial.startIfNew()
  })

  let phaseIndex = $derived(PHASES.indexOf(game.phase))
  let panel: HTMLElement
  $effect(() => {
    void game.phase
    panel?.scrollTo({ top: 0 })
  })
</script>

<LaunchCountdown />
<a class="skip" href="#panel">{uiText.skipToContent}</a>
<div class="app">
  <header>
    <h1>
      <svg class="logo" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="7" fill="url(#logo-planet)" />
        <ellipse cx="16" cy="16" rx="14" ry="5.5" fill="none" stroke="#7fd4ff" stroke-width="1.6" transform="rotate(-22 16 16)" />
        <circle cx="28.4" cy="11" r="2" fill="#ffd166" />
        <defs>
          <radialGradient id="logo-planet" cx="0.35" cy="0.35">
            <stop offset="0" stop-color="#9fe2ff" />
            <stop offset="1" stop-color="#2463b8" />
          </radialGradient>
        </defs>
      </svg>
      <span>{uiText.appName}</span>
    </h1>
    <PhaseNav phase={game.phase} canOperate={game.result !== null} onselect={(phase) => game.go(phase)} />
    <span class="level">{uiText.need.levels[game.difficulty].name}</span>
    <button type="button" class="tutorial" aria-pressed={tutorial.active} onclick={() => (tutorial.active ? tutorial.stop() : tutorial.start())}>
      {uiText.tutorial.open}
    </button>
    <BadgeShelf />
    <SoundToggle />
    <TeamPanel />
  </header>

  <ResourceBars {bars} />

  <div class="work">
    <main id="panel" class="game-panel" bind:this={panel} tabindex="-1">
      <p class="step">{phaseIndex + 1} / {PHASES.length} · {uiText.phases[game.phase].step}</p>
      <h2>{uiText.phases[game.phase].title}</h2>
      {#if game.linkStatus}
        <p class="note" role="status">{game.linkStatus === 'loaded' ? uiText.share.loaded : uiText.share.loadFailed}</p>
      {/if}

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

    <section class="stage" aria-label={uiText.stage.label} data-tour="stage">
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
      <TutorialCoach />
    </section>
  </div>
</div>

<style>
  .app {
    display: grid;
    /* One column no wider than the screen: the header and bars shrink to fit. */
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto minmax(0, 1fr);
    height: 100dvh;
  }
  header {
    position: relative;
    z-index: 6;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem 0.6rem;
    padding: 0.4rem 0.75rem;
    background: linear-gradient(180deg, rgba(14, 21, 38, 0.95), rgba(9, 13, 24, 0.92));
    border-bottom: 1px solid var(--line);
    box-shadow: 0 1px 0 rgba(127, 212, 255, 0.08);
  }
  h1 {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0;
    font-size: 1.05rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  h1 span {
    background: linear-gradient(90deg, #e9f6ff, #7fd4ff 60%, #c4a7ff);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .logo {
    width: 1.7rem;
    height: 1.7rem;
    flex: none;
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
  /* Narrower desktops: the level is shown in step 1, so it gives way first. */
  @media (max-width: 1400px) {
    .level {
      display: none;
    }
  }
  .tutorial[aria-pressed='true'] {
    border-color: #c4a7ff;
    color: #c4a7ff;
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
    border-right: 1px solid var(--line);
    background: var(--panel);
    backdrop-filter: blur(6px);
  }
  main:focus {
    outline: none;
  }
  .step {
    justify-self: start;
    margin: 0 0 -0.5rem;
    padding: 0.1rem 0.6rem;
    border: 1px solid rgba(127, 212, 255, 0.35);
    border-radius: 999px;
    background: rgba(127, 212, 255, 0.08);
    color: var(--accent);
    font-family: var(--display-font);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  h2 {
    margin: 0;
    font-size: 1.55rem;
    font-weight: 800;
    letter-spacing: 0.01em;
    line-height: 1.2;
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
      order: 1;
      flex-basis: 100%;
    }
    h1 {
      flex: 1;
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
