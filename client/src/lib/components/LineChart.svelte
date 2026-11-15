<script lang="ts">
  // A small line chart of one quantity over the mission, in one unit on one
  // axis. Pointing at it (or moving the timeline slider) reads out that day.
  // A table of the same numbers sits underneath for anyone who prefers it.
  import { fillTemplate, formatNumber, uiText } from '../strings/en.ts'

  interface Series {
    name: string
    color: string
    values: number[]
  }
  interface Props {
    title: string
    /** Mission day of each point, rising. */
    days: number[]
    series: Series[]
    /** Day picked on the timeline slider, shown when the pointer is elsewhere. */
    cursorDay?: number | null
  }
  let { title, days, series, cursorDay = null }: Props = $props()
  const text = uiText.operate.charts

  const WIDTH = 320
  const HEIGHT = 130
  const PAD = { left: 38, right: 10, top: 8, bottom: 20 }
  const plotWidth = WIDTH - PAD.left - PAD.right
  const plotHeight = HEIGHT - PAD.top - PAD.bottom

  /** The next 1, 2 or 5 times a power of ten at or above the largest value. */
  function niceMax(value: number): number {
    if (!(value > 0)) return 1
    const power = 10 ** Math.floor(Math.log10(value))
    return [1, 2, 5, 10].map((step) => step * power).find((step) => step >= value) ?? 10 * power
  }

  let top = $derived(niceMax(Math.max(0, ...series.flatMap((entry) => entry.values))))
  let firstDay = $derived(days[0] ?? 0)
  let lastDay = $derived(days[days.length - 1] ?? 1)
  const x = (day: number) => PAD.left + ((day - firstDay) / (lastDay - firstDay || 1)) * plotWidth
  const y = (value: number) => PAD.top + (1 - value / top) * plotHeight
  let paths = $derived(
    series.map((entry) => entry.values.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(days[index]).toFixed(1)},${y(value).toFixed(1)}`).join('')),
  )

  function nearest(day: number): number {
    let best = 0
    for (let index = 1; index < days.length; index++) {
      if (Math.abs(days[index] - day) < Math.abs(days[best] - day)) best = index
    }
    return best
  }
  let hoverIndex = $state<number | null>(null)
  let shown = $derived(hoverIndex ?? (cursorDay === null || days.length === 0 ? null : nearest(cursorDay)))

  function onPointer(event: PointerEvent) {
    const box = (event.currentTarget as SVGElement).getBoundingClientRect()
    const viewX = ((event.clientX - box.left) / box.width) * WIDTH
    hoverIndex = nearest(firstDay + ((viewX - PAD.left) / plotWidth) * (lastDay - firstDay))
  }

  /** About a dozen evenly spaced rows for the table. */
  let tableRows = $derived.by(() => {
    const stride = Math.max(1, Math.ceil(days.length / 12))
    return days.map((_, index) => index).filter((index) => index % stride === 0 || index === days.length - 1)
  })
</script>

<figure>
  <figcaption>{title}</figcaption>
  <div class="legend">
    {#if shown !== null}<span class="day">{fillTemplate(text.day, { day: days[shown] })}</span>{/if}
    {#each series as entry (entry.name)}
      <span class="key">
        {#if series.length > 1}<span class="swatch" style:background={entry.color}></span>{entry.name}{/if}
        {#if shown !== null}<strong>{formatNumber(entry.values[shown])}</strong>{/if}
      </span>
    {/each}
  </div>
  <svg viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-label={title} onpointermove={onPointer} onpointerleave={() => (hoverIndex = null)}>
    {#each [0, 0.5, 1] as share (share)}
      <line class={share === 0 ? 'axis' : 'grid'} x1={PAD.left} x2={WIDTH - PAD.right} y1={y(top * share)} y2={y(top * share)} />
      <text class="tick" x={PAD.left - 5} y={y(top * share) + 3} text-anchor="end">{formatNumber(top * share)}</text>
    {/each}
    <text class="tick" x={PAD.left} y={HEIGHT - 5}>{fillTemplate(text.day, { day: firstDay })}</text>
    <text class="tick" x={WIDTH - PAD.right} y={HEIGHT - 5} text-anchor="end">{fillTemplate(text.day, { day: lastDay })}</text>
    {#each paths as path, index (series[index].name)}
      <path d={path} fill="none" stroke={series[index].color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    {/each}
    {#if shown !== null}
      <line class="cursor" x1={x(days[shown])} x2={x(days[shown])} y1={PAD.top} y2={PAD.top + plotHeight} />
      {#each series as entry (entry.name)}
        <circle cx={x(days[shown])} cy={y(entry.values[shown])} r="4" fill={entry.color} stroke="#0b101c" stroke-width="2" />
      {/each}
    {/if}
  </svg>
  <details>
    <summary>{text.table}</summary>
    <table>
      <thead>
        <tr>
          <th scope="col">{text.dayColumn}</th>
          {#each series as entry (entry.name)}<th scope="col">{entry.name}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each tableRows as index (index)}
          <tr>
            <th scope="row">{days[index]}</th>
            {#each series as entry (entry.name)}<td>{formatNumber(entry.values[index])}</td>{/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </details>
</figure>

<style>
  figure {
    margin: 0;
    padding: 0.6rem 0.7rem;
    border: 1px solid #2a3650;
    border-radius: 8px;
    background: #0b101c;
  }
  figcaption {
    font-weight: 600;
    font-size: 0.875rem;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.1rem 0.8rem;
    min-height: 1.4rem;
    color: #c3cbd9;
    font-size: 0.75rem;
  }
  .key {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .key strong {
    color: #f0efec;
    font-variant-numeric: tabular-nums;
  }
  .swatch {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    touch-action: pan-y;
  }
  .grid {
    stroke: #232c3f;
    stroke-width: 1;
  }
  .axis {
    stroke: #3d4960;
    stroke-width: 1;
  }
  .cursor {
    stroke: #898781;
    stroke-width: 1;
  }
  .tick {
    fill: #898781;
    font-size: 9px;
    font-variant-numeric: tabular-nums;
  }
  summary {
    color: #a9b6cc;
    font-size: 0.75rem;
    cursor: pointer;
  }
  summary:focus-visible {
    outline: 2px solid #7fd4ff;
    outline-offset: 2px;
  }
  table {
    width: 100%;
    margin-top: 0.3rem;
    border-collapse: collapse;
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: 0.1rem 0.4rem;
    border-bottom: 1px solid #232c3f;
    text-align: right;
    font-weight: 400;
  }
  thead th {
    color: #a9b6cc;
  }
</style>
