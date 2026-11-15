<script lang="ts">
  // Step 4: build the mission. Three tabs, one for each segment the player
  // designs: the spacecraft, the launch and the ground stations.
  import { catalog } from '../lib/content/index.ts'
  import LockNote from '../lib/components/LockNote.svelte'
  import OptionCard from '../lib/components/OptionCard.svelte'
  import RequirementList from '../lib/components/RequirementList.svelte'
  import type {
    Component,
    ComponentCategory,
    Design,
    GroundStation,
    Instrument,
    Launcher,
  } from '../lib/sim/types.ts'
  import { game } from '../lib/stores/game.svelte.ts'
  import { fillTemplate, formatMoney, formatNumber, physicsTooltips, uiText } from '../lib/strings/en.ts'

  const text = uiText.design
  type Tab = keyof typeof text.tabs
  const TABS: Tab[] = ['space', 'launch', 'ground']
  let tab = $state<Tab>('space')

  type SingleSlot = 'structureId' | 'solarArrayId' | 'batteryId' | 'computerId' | 'attitudeControlId' | 'propulsionId'
  /** The slots that hold one part each. `optional` adds a "None" choice. */
  const SINGLE: { key: SingleSlot; slot: keyof typeof text.slots; category: ComponentCategory; optional: boolean }[] = [
    { key: 'structureId', slot: 'structure', category: 'structure', optional: false },
    { key: 'solarArrayId', slot: 'solarArray', category: 'solar_array', optional: true },
    { key: 'batteryId', slot: 'battery', category: 'battery', optional: true },
    { key: 'computerId', slot: 'computer', category: 'computer', optional: false },
    { key: 'attitudeControlId', slot: 'attitudeControl', category: 'attitude_control', optional: true },
    { key: 'propulsionId', slot: 'propulsion', category: 'propulsion', optional: true },
  ]
  const radios = catalog.components.filter((part) => part.category === 'communications')

  let design = $derived(game.design)
  let structure = $derived(game.analysis.resolved.structure)
  let mission = $derived(game.analysis.budgets.mission)
  let objectiveId = $derived(game.scenario.objective_id)

  const tier = (part: { tier: string }) => (part.tier === 'advanced' ? uiText.tierAdvanced : uiText.tierSimple)

  /** Why a part cannot go on the chosen frame, or null if it can. */
  function fitReason(part: Component | Instrument): string | null {
    if (!structure || !part.fits_form_factors_u || part.fits_form_factors_u.includes(structure.form_factor_u)) return null
    return fillTemplate(text.madeFor, { sizes: part.fits_form_factors_u.join(', '), size: structure.form_factor_u })
  }

  function facts(part: Component | Instrument): string[] {
    const list = [fillTemplate(text.mass, { kg: part.mass_kg }), formatMoney(part.cost_musd)]
    if (part.power_w > 0) list.push(fillTemplate(text.powerMakes, { w: part.power_w }))
    else if (part.power_w < 0) list.push(fillTemplate(text.powerUses, { w: -part.power_w }))
    if (part.category === 'structure') {
      list.push(fillTemplate(text.facts.size, { u: part.form_factor_u }))
      list.push(fillTemplate(text.facts.massLimit, { kg: part.max_mass_kg }))
    } else if (part.category === 'battery') list.push(fillTemplate(text.facts.stores, { wh: part.capacity_wh }))
    else if (part.category === 'computer') list.push(fillTemplate(text.facts.storage, { gb: part.storage_gb }))
    else if (part.category === 'communications') {
      list.push(fillTemplate(text.facts.dataRate, { rate: part.max_data_rate_mbps }))
      list.push(part.two_way ? text.facts.twoWay : text.facts.oneWay)
    } else if (part.category === 'instrument') {
      list.push(fillTemplate(text.facts.pixel, { m: part.ground_resolution_m_at_500km }))
      list.push(fillTemplate(text.facts.strip, { km: part.swath_km_at_500km }))
      list.push(fillTemplate(text.facts.bands, { count: part.band_count }))
    }
    return list
  }

  function toggle(list: 'radioIds' | 'instrumentIds', id: string) {
    const current = design[list]
    design[list] = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
  }

  // ------------------------------------------------------------- launch ---

  function launcherFacts(launcher: Launcher): string[] {
    const capacity = design.orbitId ? launcher.capacity_kg_by_orbit[design.orbitId] : undefined
    return [
      launcher.launch_type === 'dedicated' ? text.dedicated : text.rideshare,
      formatMoney(launcher.cost_musd),
      capacity == null ? (design.orbitId ? text.doesNotFly : text.capacityNoOrbit) : fillTemplate(text.capacity, { kg: capacity }),
      fillTemplate(text.record, { successes: launcher.launch_successes, attempts: launcher.launch_attempts }),
      fillTemplate(text.fairing, { diameter: launcher.fairing_diameter_m, height: launcher.fairing_height_m }),
    ]
  }
  const launcherReason = (launcher: Launcher) =>
    design.orbitId && launcher.capacity_kg_by_orbit[design.orbitId] == null ? text.doesNotFly : null

  // ------------------------------------------------------------- ground ---

  const DEFAULT_PASSES_PER_DAY = 4

  function stationFacts(station: GroundStation): string[] {
    const bands = [
      station.s_band_g_over_t_db_k !== undefined ? text.bands.s : null,
      station.x_band_g_over_t_db_k !== undefined ? text.bands.x : null,
    ].filter((band) => band !== null)
    return [
      fillTemplate(text.hears, { bands: bands.join(', ') }),
      fillTemplate(text.latitude, { deg: station.latitude_deg }),
      fillTemplate(text.passCost, { cost: formatMoney(station.cost_usd_per_pass / 1e6) }),
    ]
  }
  const booking = (design: Design, stationId: string) => design.groundStations.find((entry) => entry.stationId === stationId)
  function toggleStation(stationId: string) {
    design.groundStations = booking(design, stationId)
      ? design.groundStations.filter((entry) => entry.stationId !== stationId)
      : [...design.groundStations, { stationId, passesPerDay: DEFAULT_PASSES_PER_DAY }]
  }

  let imagingMax = $derived(mission ? Math.floor(mission.imaging.maxSPerDay / 60) : 0)
</script>

<p>{text.intro}</p>

<div class="tabs" role="tablist" aria-label={text.tabsLabel}>
  {#each TABS as id (id)}
    <button type="button" role="tab" id="design-tab-{id}" aria-selected={tab === id} aria-controls="design-tabpanel" onclick={() => (tab = id)}>
      {text.tabs[id]}
    </button>
  {/each}
</div>

<div id="design-tabpanel" role="tabpanel" aria-labelledby="design-tab-{tab}">
  {#if tab === 'space'}
    {#each SINGLE as { key, slot, category, optional } (key)}
      <fieldset>
        <legend>{text.slots[slot].name}</legend>
        <p class="note">{text.slots[slot].text}</p>
        <LockNote path="design.{key}" />
        {#each catalog.components.filter((part) => part.category === category) as part (part.id)}
          <OptionCard
            type="radio"
            name={key}
            title={part.name}
            badge={tier(part)}
            description={part.description}
            why={part.why_it_matters}
            facts={facts(part)}
            selected={design[key] === part.id}
            reason={fitReason(part)}
            locked={!game.canEdit(`design.${key}`)}
            onselect={() => (design[key] = part.id)}
          />
        {/each}
        {#if optional}
          <OptionCard
            type="radio"
            name={key}
            title={uiText.none}
            description={uiText.noneDescription}
            selected={design[key] === null}
            locked={!game.canEdit(`design.${key}`)}
            onselect={() => (design[key] = null)}
          />
        {/if}
      </fieldset>
    {/each}

    <fieldset>
      <legend>{text.slots.radios.name}</legend>
      <p class="note">{text.slots.radios.text}</p>
      <LockNote path="design.radioIds" />
      {#each radios as part (part.id)}
        <OptionCard
          type="checkbox"
          name="radios"
          title={part.name}
          badge={tier(part)}
          description={part.description}
          why={part.why_it_matters}
          facts={facts(part)}
          selected={design.radioIds.includes(part.id)}
          reason={fitReason(part)}
          locked={!game.canEdit('design.radioIds')}
          onselect={() => toggle('radioIds', part.id)}
        />
      {/each}
    </fieldset>

    <fieldset>
      <legend>{text.slots.instruments.name}</legend>
      <p class="note">{text.slots.instruments.text}</p>
      <LockNote path="design.instrumentIds" />
      {#each catalog.instruments as part (part.id)}
        <OptionCard
          type="checkbox"
          name="instruments"
          title={part.name}
          badge={tier(part)}
          description={part.description}
          why={part.why_it_matters}
          facts={facts(part)}
          selected={design.instrumentIds.includes(part.id)}
          reason={part.compatible_objectives.includes(objectiveId) ? fitReason(part) : (part.limitation ?? text.cannotServe)}
          locked={!game.canEdit('design.instrumentIds')}
          onselect={() => toggle('instrumentIds', part.id)}
        />
      {/each}

      <label class="field">
        <span>{text.imagingLabel}: <strong>{fillTemplate(text.imagingValue, { minutes: design.imagingMinutesPerDay })}</strong></span>
        <input
          type="range"
          min="0"
          max={imagingMax}
          step="1"
          disabled={!mission || !game.canEdit('design.imagingMinutesPerDay')}
          bind:value={design.imagingMinutesPerDay}
        />
      </label>
      <p class="note">
        {mission ? fillTemplate(text.imagingHelp, { max: imagingMax }) : text.imagingNeedsOrbit}
      </p>
    </fieldset>
  {:else if tab === 'launch'}
    <fieldset>
      <legend>{text.tabs.launch}</legend>
      <p class="note">{text.launcherIntro}</p>
      <LockNote path="design.launcherId" />
      {#each catalog.launchers as launcher (launcher.id)}
        <OptionCard
          type="radio"
          name="launcher"
          title={launcher.name}
          badge={launcher.provider}
          description={launcher.description}
          why={launcher.why_it_matters}
          facts={launcherFacts(launcher)}
          selected={design.launcherId === launcher.id}
          reason={launcherReason(launcher)}
          locked={!game.canEdit('design.launcherId')}
          onselect={() => (design.launcherId = launcher.id)}
        />
      {/each}
    </fieldset>
  {:else}
    <fieldset>
      <legend>{text.tabs.ground}</legend>
      <p class="note">{text.stationIntro}</p>
      <LockNote path="design.groundStations" />
      {#each catalog.groundStations as station (station.id)}
        {@const booked = booking(design, station.id)}
        {@const link = mission?.links.find((entry) => entry.stationId === station.id)}
        <OptionCard
          type="checkbox"
          name="stations"
          title={station.name}
          badge={station.operator}
          description={station.description}
          why={station.why_it_matters}
          facts={stationFacts(station)}
          selected={booked !== undefined}
          locked={!game.canEdit('design.groundStations')}
          onselect={() => toggleStation(station.id)}
        >
          {#if booked}
            <label class="field">
              <span>{fillTemplate(text.passesLabel, { station: station.name })}</span>
              <input
                type="number"
                min="0"
                max="30"
                step="0.5"
                disabled={!game.canEdit('design.groundStations')}
                bind:value={booked.passesPerDay}
              />
            </label>
            {#if link}
              <p class="note">{fillTemplate(text.passesOffer, { available: formatNumber(link.availablePassesPerDay) })}</p>
            {/if}
          {/if}
        </OptionCard>
      {/each}
    </fieldset>
    <details class="tip">
      <summary>{uiText.moreInfo} {physicsTooltips.linkBudget.title}</summary>
      <p>{physicsTooltips.linkBudget.text}</p>
    </details>
  {/if}
</div>

<h3>{uiText.requirements.forecastTitle}</h3>
<p class="note">{uiText.requirements.forecastNote}</p>
<RequirementList requirements={game.scenario.requirements} results={game.forecast.requirements} />

<style>
  .tabs {
    display: flex;
    gap: 0.25rem;
    border-bottom: 1px solid #2a3650;
  }
  .tabs button {
    border: 0;
    border-bottom: 3px solid transparent;
    border-radius: 6px 6px 0 0;
    background: none;
  }
  .tabs button[aria-selected='true'] {
    border-bottom-color: #7fd4ff;
    color: #fff;
    font-weight: 600;
  }
  #design-tabpanel {
    display: grid;
    gap: 1rem;
  }
</style>
