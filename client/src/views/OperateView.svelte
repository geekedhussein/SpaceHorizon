<script lang="ts">
  // Step 6: the mission flown, day by day, and the report that explains it.
  import { untrack } from 'svelte'
  import LineChart from '../lib/components/LineChart.svelte'
  import RequirementList from '../lib/components/RequirementList.svelte'
  import { game } from '../lib/stores/game.svelte.ts'
  import { describeCause, fillTemplate, formatNumber, uiText } from '../lib/strings/en.ts'

  interface Props {
    /** Tell the orbit view to jump to a mission day. */
    onday: (day: number) => void
  }
  let { onday }: Props = $props()
  const text = uiText.operate

  // Chart colours: the first two slots of the chart palette on a dark surface.
  const SERIES_1 = '#3987e5'
  const SERIES_2 = '#d95926'
  /** Most points drawn per line. More would not show at this size. */
  const MAX_POINTS = 240
  const SYMBOL = { info: 'i', warning: '!', failure: '✕' } as const

  let result = $derived(game.result)
  let steps = $derived(result?.steps ?? [])
  let day = $state(1)

  // A new flight starts the timeline again from day 1.
  $effect(() => {
    void result
    untrack(() => {
      day = 1
    })
  })
  let step = $derived(steps[Math.min(day, steps.length) - 1])

  /** Every k-th day, plus the last, so long missions stay light to draw. */
  let sampled = $derived.by(() => {
    const stride = Math.max(1, Math.ceil(steps.length / MAX_POINTS))
    return steps.filter((_, index) => index % stride === 0 || index === steps.length - 1)
  })
  let days = $derived(sampled.map((entry) => entry.day))
</script>

{#if !result}
  <p>{text.notFlown}</p>
  <button type="button" onclick={() => game.go('verify')}>{uiText.phases.verify.name}</button>
{:else}
  <div class="outcome {result.outcome.status === 'completed' ? 'good' : 'bad'}" role="status">
    <strong>{text.statuses[result.outcome.status]}</strong>
    <span>{fillTemplate(text.daysFlown, { days: result.outcome.endDay, planned: result.plannedDays })}</span>
  </div>
  {#if game.justUnlocked}<p class="note"><strong>{text.unlocked}</strong></p>{/if}
  {#if game.designChangedSinceLaunch}<p class="note">{text.designChanged}</p>{/if}

  <section>
    <h3>{text.scoreTitle}: {fillTemplate(text.scoreOf, { points: Math.round(result.score.total) })}</h3>
    <table class="score">
      <tbody>
        {#each result.score.parts.filter((part) => part.weight > 0) as part (part.id)}
          <tr>
            <th scope="row">{text.scoreParts[part.id]}</th>
            <td class="track"><div class="fill" style:width="{part.fraction * 100}%"></div></td>
            <td class="points">{fillTemplate(text.pointsOf, { points: formatNumber(part.points), weight: part.weight })}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>

  <section>
    <h3>{text.requirementsTitle}</h3>
    <RequirementList requirements={game.scenario.requirements} results={result.requirements} />
  </section>

  <section>
    <h3>{text.causesTitle}</h3>
    <ul class="causes">
      {#each result.causes as cause, index (index)}
        {@const words = describeCause(cause)}
        <li class={cause.severity}>
          <span class="severity"><span aria-hidden="true">{SYMBOL[cause.severity]}</span> {text.severity[cause.severity]}</span>
          <span>{words.text}</span>
          {#if words.fix}<span class="fix"><strong>{text.nextTime}</strong> {words.fix}</span>{/if}
        </li>
      {/each}
    </ul>
  </section>

  {#if steps.length > 0 && step}
    <section>
      <h3>{text.timelineTitle}</h3>
      <label class="field">
        <span>{text.dayLabel}: <strong>{fillTemplate(text.dayValue, { day: step.day })}</strong></span>
        <input type="range" min="1" max={steps.length} step="1" bind:value={day} oninput={() => onday(day)} />
      </label>
      <p class="note">{text.timelineHelp}</p>
      <ul class="dayfacts">
        <li>{fillTemplate(text.dayFacts.altitude, { km: formatNumber(step.altitudeKm) })}</li>
        <li>{fillTemplate(text.dayFacts.power, { made: step.generationW, used: step.consumptionW })}</li>
        <li>{fillTemplate(text.dayFacts.data, { made: step.dataGeneratedGb, sent: step.dataDownlinkedGb, lost: step.dataLostGb })}</li>
        <li>{fillTemplate(text.dayFacts.stored, { gb: step.dataStoredGb })}</li>
      </ul>
      <div class="charts">
        <LineChart
          title={text.charts.power}
          {days}
          cursorDay={day}
          series={[
            { name: text.charts.generation, color: SERIES_1, values: sampled.map((entry) => entry.generationW) },
            { name: text.charts.consumption, color: SERIES_2, values: sampled.map((entry) => entry.consumptionW) },
          ]}
        />
        <LineChart
          title={text.charts.data}
          {days}
          cursorDay={day}
          series={[
            { name: text.charts.generated, color: SERIES_1, values: sampled.map((entry) => entry.dataGeneratedGb) },
            { name: text.charts.downlinked, color: SERIES_2, values: sampled.map((entry) => entry.dataDownlinkedGb) },
          ]}
        />
        <LineChart
          title={text.charts.stored}
          {days}
          cursorDay={day}
          series={[{ name: text.charts.stored, color: SERIES_1, values: sampled.map((entry) => entry.dataStoredGb) }]}
        />
        <LineChart
          title={text.charts.altitude}
          {days}
          cursorDay={day}
          series={[{ name: text.charts.altitude, color: SERIES_1, values: sampled.map((entry) => entry.altitudeKm) }]}
        />
      </div>
    </section>
  {/if}

  <section class="resembles">
    <h3>{fillTemplate(text.resemblesTitle, { mission: game.scenario.real_mission_name })}</h3>
    <p>{game.scenario.real_mission_fact}</p>
    <p class="note">
      {text.source}: <a href={game.scenario.real_mission_source} target="_blank" rel="noreferrer">{game.scenario.real_mission_source}</a>
    </p>
  </section>

  <p class="note">{fillTemplate(text.seed, { seed: String(result.seed) })}</p>
  <div class="buttons">
    <button type="button" onclick={() => game.go('design')}>{uiText.verify.changeDesign}</button>
    <button type="button" class="primary" disabled={game.blocked} onclick={() => game.launch()}>{text.relaunch}</button>
  </div>
{/if}

<style>
  section {
    display: grid;
    gap: 0.4rem;
  }
  .outcome {
    display: grid;
    gap: 0.15rem;
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--status);
    border-left-width: 5px;
    border-radius: 8px;
    background: #0f1626;
  }
  .good {
    --status: #0ca30c;
  }
  .bad {
    --status: #d03b3b;
  }
  .score {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }
  .score th {
    padding: 0.2rem 0.5rem 0.2rem 0;
    text-align: left;
    font-weight: 400;
  }
  .score .track {
    width: 35%;
  }
  .score .track::before {
    content: '';
  }
  .score .fill {
    height: 8px;
    min-width: 2px;
    border-radius: 4px;
    background: #3987e5;
  }
  .score td.track {
    background: linear-gradient(#222c40, #222c40) center / 100% 8px no-repeat;
  }
  .points {
    padding-left: 0.5rem;
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .causes,
  .dayfacts {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .causes li {
    display: grid;
    gap: 0.2rem;
    padding: 0.5rem 0.7rem;
    border: 1px solid #2a3650;
    border-left: 4px solid var(--status);
    border-radius: 8px;
    background: #0f1626;
    font-size: 0.8125rem;
  }
  .info {
    --status: #898781;
  }
  .warning {
    --status: #fab219;
  }
  .failure {
    --status: #d03b3b;
  }
  .severity {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .dayfacts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.2rem 0.75rem;
    color: #c3cbd9;
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }
  .charts {
    display: grid;
    gap: 0.5rem;
  }
  .resembles {
    padding: 0.6rem 0.8rem;
    border: 1px solid #2a3650;
    border-radius: 8px;
    background: #0f1626;
  }
  .resembles p {
    margin: 0;
  }
  a {
    color: #9fd8ff;
    overflow-wrap: anywhere;
  }
  .buttons {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
  }
</style>
