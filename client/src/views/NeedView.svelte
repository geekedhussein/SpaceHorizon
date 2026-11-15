<script lang="ts">
  // Step 1: pick the mission and how deep the study goes.
  import { scenarios } from '../lib/content/index.ts'
  import LockNote from '../lib/components/LockNote.svelte'
  import OptionCard from '../lib/components/OptionCard.svelte'
  import type { Difficulty } from '../lib/sim/types.ts'
  import { game } from '../lib/stores/game.svelte.ts'
  import { fillTemplate, formatMoney, uiText } from '../lib/strings/en.ts'

  const text = uiText.need
  const LEVELS: Difficulty[] = ['concept', 'trade-study', 'point-design']
</script>

<p>{text.intro}</p>

<fieldset>
  <legend>{text.scenarioLabel}</legend>
  <LockNote path="scenarioId" />
  {#each scenarios as scenario (scenario.id)}
    <OptionCard
      type="radio"
      name="scenario"
      title={scenario.name}
      description={scenario.summary}
      why="{text.objective}: {scenario.objective}"
      facts={[
        `${text.budget}: ${formatMoney(scenario.budget_musd)}`,
        `${text.lifetime}: ${fillTemplate(text.years, { years: scenario.planned_lifetime_years })}`,
      ]}
      selected={game.scenarioId === scenario.id}
      locked={!game.canEdit('scenarioId')}
      onselect={() => (game.scenarioId = scenario.id)}
    />
  {/each}
</fieldset>

<fieldset>
  <legend>{text.levelLabel}</legend>
  <LockNote path="difficulty" />
  {#each LEVELS as level (level)}
    <OptionCard
      type="radio"
      name="level"
      title={text.levels[level].name}
      description={text.levels[level].text}
      selected={game.difficulty === level}
      locked={!game.canEdit('difficulty')}
      reason={level === 'point-design' && !game.pointDesignUnlocked ? text.levelLocked : null}
      onselect={() => (game.difficulty = level)}
    />
  {/each}
  <p class="note">{text.physicsNote}</p>
  <label class="check"><input type="checkbox" bind:checked={game.sandbox} disabled={!game.canEdit('sandbox')} /> {text.sandbox}</label>
</fieldset>
