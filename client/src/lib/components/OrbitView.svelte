<script lang="ts">
  // The orbit view: the 3D scene with its controls and a text readout, and the
  // flat map when 3D is not available. All positions come from /lib/orbit;
  // this component only advances the clock and draws.
  import { onMount } from 'svelte'
  import { catalog } from '../content/index.ts'
  import {
    contactConeAngleRad,
    elementsForOrbit,
    groundTrack,
    missionGeometry,
    orbitPathEciM,
    periodS,
    sunSubpoint,
  } from '../orbit/index.ts'
  import { radToDeg } from '../physics/units.ts'
  import type { OrbitScene } from '../scene3d/orbitScene.ts'
  import { fillTemplate, orbitViewText as text, uiText } from '../strings/en.ts'
  import GroundTrackMap from './GroundTrackMap.svelte'

  interface Props {
    /** Id of the orbit shown, from /content/orbits.json. null: not chosen yet. */
    orbitId: string | null
    /** Stations the mission has booked. Only these count as "in contact". */
    bookedStationIds?: string[]
    /** Seconds since the start date. The mission timeline can set it. */
    tS?: number
    playing?: boolean
  }
  let { orbitId, bookedStationIds = [], tS = $bindable(0), playing = $bindable(true) }: Props = $props()

  /**
   * Stand-in start date until the mission has a launch date (the view says
   * so). Fixed, so the picture is the same for everyone.
   */
  const EPOCH_MS = Date.UTC(2027, 0, 1)
  const SPEEDS = [1, 10, 60, 300, 1800]
  const TEXTURES = {
    small: `${import.meta.env.BASE_URL}textures/earth-day-2048.webp`,
    large: `${import.meta.env.BASE_URL}textures/earth-day-4096.webp`,
  }
  const stations = catalog.groundStations

  let speed = $state(60)
  /** The two panels start open on a wide screen and closed on a phone. */
  let controlsOpen = $state(true)
  let readoutOpen = $state(true)
  let showLabels = $state(true)
  let showPath = $state(true)
  let showCones = $state(true)

  /** 'loading' until the 3D bundle is in; 'missing' if WebGL cannot start. */
  let webgl = $state<'loading' | 'ready' | 'missing'>('loading')
  let wantMap = $state(false)
  let showMap = $derived(wantMap || webgl === 'missing')

  let scene = $state.raw<OrbitScene | null>(null)
  let sceneBox: HTMLDivElement

  let orbit = $derived(catalog.orbits.find((entry) => entry.id === orbitId) ?? catalog.orbits[0])
  let elements = $derived(elementsForOrbit(orbit, EPOCH_MS))
  /** With stations booked, an unbooked station in view is not a contact. */
  let geometry = $derived.by(() => {
    const view = missionGeometry(elements, stations, EPOCH_MS, tS)
    if (bookedStationIds.length === 0) return view
    return {
      ...view,
      stations: view.stations.map((station) =>
        bookedStationIds.includes(station.stationId) ? station : { ...station, inContact: false },
      ),
    }
  })
  let sun = $derived(sunSubpoint(geometry.timeMs))
  let track = $derived(showMap ? groundTrack(elements, EPOCH_MS, tS, periodS(elements), 180) : [])

  // ------------------------------------------------------------ readout ---

  const dateFormat = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'UTC',
  })
  const degrees = (valueRad: number, positive: string, negative: string) =>
    `${Math.abs(radToDeg(valueRad)).toFixed(1)}° ${valueRad >= 0 ? positive : negative}`

  let readout = $derived({
    time: `${dateFormat.format(geometry.timeMs)} UTC`,
    height: fillTemplate(text.heightValue, { km: Math.round(geometry.subpoint.heightM / 1000) }),
    period: fillTemplate(text.periodValue, { minutes: periodS(elements) / 60 }),
    below: `${degrees(geometry.subpoint.latitudeRad, text.north, text.south)}, ${degrees(
      geometry.subpoint.longitudeRad,
      text.east,
      text.west,
    )}`,
    light: geometry.inEclipse ? text.inShadow : text.inSunlight,
    contact:
      geometry.stations
        .filter((view) => view.inContact)
        .map((view) => stations.find((station) => station.id === view.stationId)?.name ?? view.stationId)
        .join(', ') || text.noContact,
  })

  // -------------------------------------------------------------- scene ---

  $effect(() => {
    scene?.setOptions({ showLabels, showPath, showCones })
  })
  $effect(() => {
    scene?.setCone(contactConeAngleRad(orbit), elements.semiMajorAxisM)
  })

  onMount(() => {
    controlsOpen = readoutOpen = window.matchMedia('(min-width: 900px)').matches
    let stopped = false
    let frame = 0
    let last = performance.now()
    let made: OrbitScene | null = null

    // The 3D code is a separate bundle, loaded only once the page is up.
    import('../scene3d/orbitScene.ts')
      .then(({ createOrbitScene }) => {
        if (stopped) return
        made = createOrbitScene({
          container: sceneBox,
          stations: stations.map(({ id, name }) => ({ id, name })),
          labels: { spacecraft: text.spacecraftNotToScale, sun: text.sun },
          textures: TEXTURES,
        })
        scene = made
        webgl = 'ready'
      })
      .catch(() => {
        webgl = 'missing'
      })

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      // A long gap means the tab was hidden; do not jump ahead.
      const elapsedS = Math.min((now - last) / 1000, 0.1)
      last = now
      if (document.hidden) return
      if (playing) tS += elapsedS * speed
      if (made && !showMap) made.render({ geometry, pathEciM: orbitPathEciM(elements, tS) })
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
</script>

<section class="orbit-view" aria-label={text.title}>
  <!-- The scene takes keyboard focus so the arrow keys can turn the camera. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="scene"
    class:hidden={showMap}
    bind:this={sceneBox}
    role="application"
    tabindex="0"
    aria-label={text.sceneDescription}
    aria-describedby="orbit-view-hint"
    onkeydown={onSceneKey}
  ></div>

  {#if showMap}
    <div class="map">
      <GroundTrackMap {geometry} {track} {sun} {stations} textureUrl={TEXTURES.small} {showLabels} {showPath} />
    </div>
  {:else if webgl === 'loading'}
    <p class="status" role="status">{text.loading}</p>
  {/if}

  <details class="panel controls" bind:open={controlsOpen}>
    <summary>{text.title}</summary>
    <div class="body">
      {#if orbitId === null}
        <p class="note">{fillTemplate(uiText.stage.exampleOrbit, { orbit: orbit.name })}</p>
      {/if}

      <div class="row">
        <button type="button" class="play" aria-pressed={playing} onclick={() => (playing = !playing)}>
          <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
          {playing ? text.pause : text.play}
        </button>
        <label>
          <span>{text.speedLabel}</span>
          <select bind:value={speed}>
            {#each SPEEDS as factor (factor)}
              <option value={factor}>{fillTemplate(text.speedValue, { factor })}</option>
            {/each}
          </select>
        </label>
      </div>

      <fieldset>
        <legend>{text.viewLabel}</legend>
        <label class="check">
          <input type="radio" name="orbit-view-mode" checked={!showMap} disabled={webgl !== 'ready'} onchange={() => (wantMap = false)} />
          {text.view3d}
        </label>
        <label class="check">
          <input type="radio" name="orbit-view-mode" checked={showMap} onchange={() => (wantMap = true)} />
          {text.viewMap}
        </label>
      </fieldset>

      <div class="row toggles">
        <label class="check"><input type="checkbox" bind:checked={showLabels} /> {text.showLabels}</label>
        <label class="check"><input type="checkbox" bind:checked={showPath} /> {text.showPath}</label>
        {#if !showMap}
          <label class="check"><input type="checkbox" bind:checked={showCones} /> {text.showCones}</label>
        {/if}
      </div>

      {#if webgl === 'missing'}
        <p class="note" role="status">{text.webglMissing}</p>
      {/if}
      <p class="note" id="orbit-view-hint" class:hidden={showMap}>{text.controlsHint}</p>
    </div>
  </details>

  <details class="panel readout" bind:open={readoutOpen}>
    <summary>{text.readoutTitle}: {readout.light}</summary>
    <div class="body">
      <dl>
        <div><dt>{text.time}</dt><dd>{readout.time}</dd></div>
        <div><dt>{text.height}</dt><dd>{readout.height}</dd></div>
        <div><dt>{text.period}</dt><dd>{readout.period}</dd></div>
        <div><dt>{text.below}</dt><dd>{readout.below}</dd></div>
        <div>
          <dt>{text.light}</dt>
          <dd><span aria-hidden="true">{geometry.inEclipse ? '●' : '☀'}</span> {readout.light}</dd>
        </div>
        <div><dt>{text.contact}</dt><dd>{readout.contact}</dd></div>
      </dl>
      <p class="note">{text.scaleNote} {text.epochNote}</p>
    </div>
  </details>
</section>

<style>
  .orbit-view {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #05070d;
    color: #eef2f8;
  }
  .scene,
  .map {
    position: absolute;
    inset: 0;
  }
  .scene {
    /* Keeps the floating names beneath the panels. */
    isolation: isolate;
  }
  .scene:focus-visible {
    outline: 2px solid #7fd4ff;
    outline-offset: -2px;
  }
  .map {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .hidden {
    display: none;
  }
  .status {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
  }

  .panel {
    position: absolute;
    box-sizing: border-box;
    width: 17rem;
    max-width: calc(100% - 1.5rem);
    padding: 0.75rem 0.9rem;
    border: 1px solid rgba(127, 212, 255, 0.25);
    border-radius: 10px;
    background: rgba(8, 12, 22, 0.82);
    font-size: 0.875rem;
  }
  .controls {
    top: 0.75rem;
    left: 0.75rem;
  }
  .body {
    display: grid;
    gap: 0.6rem;
    margin-top: 0.5rem;
  }
  summary {
    font-weight: 600;
    cursor: pointer;
  }
  summary:focus-visible {
    outline: 2px solid #7fd4ff;
    outline-offset: 2px;
  }
  details:not([open]) {
    width: auto;
  }
  .readout {
    right: 0.75rem;
    bottom: 0.75rem;
  }

  label {
    display: grid;
    gap: 0.15rem;
  }
  label > span,
  legend,
  dt {
    color: #a9b6cc;
    font-size: 0.75rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.6rem;
  }
  .row > label {
    flex: 1;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  fieldset {
    display: flex;
    gap: 0.9rem;
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    padding: 0;
  }

  select,
  button {
    min-height: 2.25rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid #3a4963;
    border-radius: 6px;
    background: #121a2b;
    color: inherit;
    font: inherit;
  }
  select {
    width: 100%;
  }
  .play {
    min-width: 5.5rem;
    cursor: pointer;
  }
  button:hover {
    background: #1b2740;
  }
  select:focus-visible,
  button:focus-visible,
  input:focus-visible {
    outline: 2px solid #7fd4ff;
    outline-offset: 1px;
  }

  dl {
    display: grid;
    gap: 0.3rem;
    margin: 0;
  }
  dl > div {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
  }
  dd {
    margin: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .note {
    margin: 0;
    color: #a9b6cc;
    font-size: 0.75rem;
  }

  @media (max-width: 640px) {
    .panel {
      padding: 0.4rem 0.6rem;
    }
    .controls {
      top: 0.5rem;
      left: 0.5rem;
    }
    .readout {
      right: 0.5rem;
      bottom: 0.5rem;
    }
  }
</style>
