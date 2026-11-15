<script lang="ts">
  // Step 3: the objective, turned into numbers the mission must reach.
  import RequirementList from '../lib/components/RequirementList.svelte'
  import { game } from '../lib/stores/game.svelte.ts'
  import { physicsTooltips, uiText } from '../lib/strings/en.ts'

  const text = uiText.requirements
  const tips = [physicsTooltips.revisitTime, physicsTooltips.groundResolution, physicsTooltips.dragDecay]
</script>

<p>{text.intro}</p>
<p class="quote">{game.scenario.objective}</p>
<RequirementList requirements={game.scenario.requirements} />
<p class="note">{text.how}</p>

{#each tips as tip (tip.title)}
  <details class="tip">
    <summary>{uiText.moreInfo} {tip.title}</summary>
    <p>{tip.text}</p>
  </details>
{/each}

<style>
  .quote {
    padding-left: 0.75rem;
    border-left: 3px solid #7fd4ff;
    color: #dfe6f1;
  }
</style>
