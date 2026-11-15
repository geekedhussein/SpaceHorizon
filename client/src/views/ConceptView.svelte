<script lang="ts">
  // Step 2: the kind of mission, its four segments, and the orbit.
  import { catalog } from '../lib/content/index.ts'
  import LockNote from '../lib/components/LockNote.svelte'
  import OptionCard from '../lib/components/OptionCard.svelte'
  import { orbitFigures } from '../lib/sim/budgets.ts'
  import type { Orbit } from '../lib/sim/types.ts'
  import { game } from '../lib/stores/game.svelte.ts'
  import { fillTemplate, physicsTooltips, uiText } from '../lib/strings/en.ts'

  const text = uiText.concept

  function facts(orbit: Orbit): string[] {
    const figures = orbitFigures(orbit)
    return [
      fillTemplate(text.altitude, { km: orbit.altitude_km }),
      fillTemplate(text.tilt, { deg: orbit.inclination_deg }),
      fillTemplate(text.period, { minutes: figures.periodS / 60 }),
      fillTemplate(text.eclipse, { minutes: figures.eclipseS / 60 }),
      fillTemplate(text.pass, { minutes: figures.maxPassS / 60 }),
    ]
  }
  const tips = [physicsTooltips.orbitalPeriod, physicsTooltips.eclipse, physicsTooltips.contactTime, physicsTooltips.sunSynchronous]
</script>

<p>{text.intro}</p>
<dl class="segments">
  {#each text.segments as segment (segment.name)}
    <div><dt>{segment.name}</dt><dd>{segment.text}</dd></div>
  {/each}
</dl>

<h3>{text.missionType}</h3>
<p>{text.missionTypes[game.scenario.mission_type]}</p>

<fieldset data-tour="orbits">
  <legend>{text.orbitLabel}</legend>
  <p class="note">{text.orbitIntro}</p>
  <LockNote path="design.orbitId" />
  {#each catalog.orbits as orbit (orbit.id)}
    <OptionCard
      type="radio"
      name="orbit"
      title={orbit.name}
      description={orbit.description}
      why={orbit.why_it_matters}
      facts={facts(orbit)}
      selected={game.design.orbitId === orbit.id}
      locked={!game.canEdit('design.orbitId')}
      onselect={() => (game.design.orbitId = orbit.id)}
    />
  {/each}
</fieldset>

{#each tips as tip (tip.title)}
  <details class="tip">
    <summary>{uiText.moreInfo} {tip.title}</summary>
    <p>{tip.text}</p>
  </details>
{/each}

<style>
  .segments {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    margin: 0;
  }
  .segments div {
    padding: 0.5rem 0.6rem;
    border: 1px solid #2a3650;
    border-radius: 8px;
    background: #0f1626;
  }
  dt {
    font-weight: 600;
  }
  dd {
    margin: 0;
    color: #c3cbd9;
    font-size: 0.8125rem;
  }
</style>
