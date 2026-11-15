<script lang="ts">
  // The spacecraft builder picture: the 3D model of the chosen parts, or a flat
  // front view when 3D is not available. It draws what builderModel.ts lists.
  import { onMount } from 'svelte'
  import type { ResolvedDesign } from '../sim/budgets.ts'
  import { builderModel } from '../scene3d/builderModel.ts'
  import type { BuilderPartKind } from '../scene3d/builderModel.ts'
  import type { BuilderScene } from '../scene3d/builderScene.ts'
  import { uiText } from '../strings/en.ts'

  interface Props {
    resolved: ResolvedDesign
  }
  let { resolved }: Props = $props()
  const text = uiText.builder

  let showLabels = $state(true)
  let labelsChosen = false
  let showFairing = $state(false)
  let webgl = $state<'loading' | 'ready' | 'missing'>('loading')
  let scene = $state.raw<BuilderScene | null>(null)
  let sceneBox: HTMLDivElement

  let model = $derived(builderModel(resolved))
  let empty = $derived(model.parts.length === 0)

  $effect(() => {
    scene?.setOptions({ showLabels, showFairing })
  })
  $effect(() => {
    scene?.setModel(model)
  })

  onMount(() => {
    // Names crowd a small screen, so they start off there.
    if (!labelsChosen) showLabels = window.matchMedia('(min-width: 700px)').matches
    let stopped = false
    let frame = 0
    let made: BuilderScene | null = null
    import('../scene3d/builderScene.ts')
      .then(({ createBuilderScene }) => {
        if (stopped) return
        made = createBuilderScene(sceneBox)
        scene = made
        webgl = 'ready'
      })
      .catch(() => {
        webgl = 'missing'
      })
    const tick = () => {
      frame = requestAnimationFrame(tick)
      if (!document.hidden) made?.render()
    }
    frame = requestAnimationFrame(tick)
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      made?.dispose()
    }
  })

  function onSceneKey(event: KeyboardEvent) {
    if (!scene) return
    const turn = 0.12
    if (event.key === 'ArrowLeft') scene.turnCamera(-turn, 0)
    else if (event.key === 'ArrowRight') scene.turnCamera(turn, 0)
    else if (event.key === 'ArrowUp') scene.turnCamera(0, turn)
    else if (event.key === 'ArrowDown') scene.turnCamera(0, -turn)
    else if (event.key === '+' || event.key === '=') scene.zoomCamera(0.9)
    else if (event.key === '-' || event.key === '_') scene.zoomCamera(1.1)
    else return
    event.preventDefault()
  }

  // ---------------------------------------------------- flat front view ---

  const FILL: Record<BuilderPartKind, string> = {
    bus: 'rgba(201, 210, 224, 0.18)',
    internal: '#5b7fb8',
    solar: '#1d3f8f',
    antenna: '#e0b05a',
    lens: '#3a4152',
    nozzle: '#8a93a6',
  }
  /** Front view: x across, y up. Sizes in millimetres so strokes stay thin. */
  let diagram = $derived.by(() => {
    const reach = Math.max(model.reachM, 0.05) * 1000 * 1.25
    return {
      viewBox: `${-reach} ${-reach} ${2 * reach} ${2 * reach}`,
      rects: model.parts.map((part) => ({
        key: part.key,
        x: (part.centerM[0] - part.sizeM[0] / 2) * 1000,
        y: (-part.centerM[1] - part.sizeM[1] / 2) * 1000,
        width: part.sizeM[0] * 1000,
        height: part.sizeM[1] * 1000,
        fill: FILL[part.kind],
        label: part.label,
      })),
      fontSize: reach / 16,
    }
  })
</script>

<section class="builder" aria-label={text.title}>
  <!-- The scene takes keyboard focus so the arrow keys can turn the camera. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="scene"
    class:hidden={webgl === 'missing'}
    bind:this={sceneBox}
    role="application"
    tabindex="0"
    aria-label={text.sceneDescription}
    onkeydown={onSceneKey}
  ></div>

  {#if webgl === 'missing' && !empty}
    <svg class="diagram" viewBox={diagram.viewBox} role="img" aria-label={text.diagramDescription}>
      {#each diagram.rects as rect (rect.key)}
        <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={rect.fill} stroke="#fff" stroke-width="0.6" />
      {/each}
      {#if showLabels}
        {#each diagram.rects as rect (rect.key)}
          {#if rect.label}
            <text x={rect.x + rect.width / 2} y={rect.y + rect.height / 2} font-size={diagram.fontSize} text-anchor="middle" dominant-baseline="middle">{rect.label}</text>
          {/if}
        {/each}
      {/if}
    </svg>
  {/if}

  {#if empty}
    <p class="status">{text.empty}</p>
  {:else if webgl === 'loading'}
    <p class="status" role="status">{text.loading}</p>
  {/if}

  <div class="panel">
    <div class="row">
      <label class="check"><input type="checkbox" bind:checked={showLabels} onchange={() => (labelsChosen = true)} /> {text.showLabels}</label>
      {#if webgl !== 'missing'}
        <label class="check">
          <input type="checkbox" bind:checked={showFairing} disabled={model.fairing === null} />
          {text.showFairing}
        </label>
      {/if}
    </div>
    {#if webgl === 'missing'}
      <p class="note" role="status">{text.webglMissing}</p>
    {/if}
    <p class="note">{text.scaleNote}{showFairing ? ` ${text.fairingNote}` : ''}</p>
  </div>
</section>

<style>
  .builder {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #05070d;
    color: #eef2f8;
  }
  .scene {
    /* Keeps the floating names beneath the panels. */
    isolation: isolate;
  }
  .scene,
  .diagram {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .scene:focus-visible {
    outline: 2px solid #7fd4ff;
    outline-offset: -2px;
  }
  .hidden {
    display: none;
  }
  .diagram text {
    fill: #fff;
    paint-order: stroke;
    stroke: #05070d;
    stroke-width: 3px;
  }
  .status {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    padding: 1rem;
    text-align: center;
    pointer-events: none;
  }
  .panel {
    position: absolute;
    left: 0.75rem;
    bottom: 0.75rem;
    box-sizing: border-box;
    max-width: min(22rem, calc(100% - 1.5rem));
    padding: 0.5rem 0.75rem;
    border: 1px solid rgba(127, 212, 255, 0.25);
    border-radius: 10px;
    background: rgba(8, 12, 22, 0.82);
    font-size: 0.8125rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 1.75rem;
  }
  .note {
    margin: 0.25rem 0 0;
    color: #a9b6cc;
    font-size: 0.75rem;
  }
  input:focus-visible {
    outline: 2px solid #7fd4ff;
    outline-offset: 1px;
  }
</style>
