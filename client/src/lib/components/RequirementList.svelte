<script lang="ts">
  // The scenario's requirements, each with its goal and, when the mission has
  // been flown or forecast, whether it was met and by how much.
  import type { Requirement, RequirementResult } from '../sim/types.ts'
  import { fillTemplate, formatNumber, uiText } from '../strings/en.ts'

  interface Props {
    requirements: Requirement[]
    results?: RequirementResult[]
  }
  let { requirements, results }: Props = $props()
  const text = uiText.requirements

  function goal(requirement: Requirement): string {
    const template = requirement.comparator === '<=' ? text.atMost : text.atLeast
    return fillTemplate(template, { threshold: requirement.threshold, unit: requirement.unit })
  }
  /** Spare room as a share of the goal; negative when the goal was missed. */
  function marginPercent(result: RequirementResult): number | null {
    if (result.value === null || result.threshold === 0) return null
    const spare = result.comparator === '<=' ? result.threshold - result.value : result.value - result.threshold
    return (spare / result.threshold) * 100
  }
</script>

<ul>
  {#each requirements as requirement (requirement.id)}
    {@const result = results?.find((entry) => entry.id === requirement.id)}
    <li class:met={result?.met} class:missed={result && !result.met}>
      <div class="label">{requirement.label}</div>
      <div class="why">{requirement.why_it_matters}</div>
      <div class="goal">{text.goal}: {goal(requirement)}</div>
      {#if result}
        {@const margin = marginPercent(result)}
        <div class="result">
          <span class="verdict">
            <span aria-hidden="true">{result.met ? '✓' : '✕'}</span>
            {result.met ? text.met : text.notMet}
          </span>
          <span>
            {result.value === null
              ? text.noValue
              : fillTemplate(text.value, { value: formatNumber(result.value), unit: result.unit })}
          </span>
          {#if margin !== null}
            <span>{fillTemplate(text.margin, { percent: formatNumber(Math.round(margin)) })}</span>
          {/if}
        </div>
      {/if}
    </li>
  {/each}
</ul>

<style>
  ul {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    padding: 0.6rem 0.7rem;
    border: 1px solid #2a3650;
    border-left-width: 4px;
    border-radius: 8px;
    background: #0f1626;
  }
  .met {
    border-left-color: #0ca30c;
  }
  .missed {
    border-left-color: #d03b3b;
  }
  .label {
    font-weight: 600;
  }
  .why,
  .goal {
    color: #a9b6cc;
    font-size: 0.8125rem;
  }
  .goal {
    color: #dfe6f1;
    margin-top: 0.2rem;
  }
  .result {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.9rem;
    margin-top: 0.35rem;
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }
  .verdict {
    font-weight: 700;
  }
</style>
