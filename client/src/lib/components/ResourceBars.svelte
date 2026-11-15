<script lang="ts">
  // The six resources, always on screen. Each bar says its state in words and
  // with a symbol, so colour is never the only signal.
  import { formatMoney, formatNumber, uiText } from '../strings/en.ts'
  import type { ResourceBar } from './resourceBars.ts'

  interface Props {
    bars: ResourceBar[]
  }
  let { bars }: Props = $props()
  const text = uiText.resources

  const SYMBOL = { ok: '✓', tight: '!', over: '✕', none: '–' } as const

  function amount(bar: ResourceBar, value: number): string {
    return bar.id === 'budget' ? formatMoney(value).replace(' million', 'M') : formatNumber(value)
  }
  function statusWord(bar: ResourceBar): string {
    if (bar.status === 'over' && bar.moreIsBetter) return text.status.short
    return text.status[bar.status]
  }
</script>

<section class="bars" aria-label={text.title} data-tour="bars">
  {#each bars as bar (bar.id)}
    {@const entry = text[bar.id]}
    {@const word = statusWord(bar)}
    <div class="bar {bar.status}" title={entry.caption}>
      <div class="top">
        <span class="name">{entry.name}</span>
        <span class="state"><span class="symbol" aria-hidden="true">{SYMBOL[bar.status]}</span> {word}</span>
      </div>
      <div
        class="track"
        role="meter"
        aria-label="{entry.name}: {word}"
        aria-valuemin="0"
        aria-valuemax={bar.limit ?? 0}
        aria-valuenow={bar.used ?? 0}
      >
        <div class="fill" style:width="{bar.fraction * 100}%"></div>
      </div>
      <div class="value">
        {#if bar.used !== null && bar.limit !== null}
          {amount(bar, bar.used)} {text.of} {amount(bar, bar.limit)} {entry.unit}
        {:else if bar.used !== null && bar.id === 'mass'}
          {amount(bar, bar.used)} {entry.unit}
        {:else}
          {entry.empty}
        {/if}
      </div>
      <span class="visually-hidden">{entry.caption}</span>
    </div>
  {/each}
</section>

<style>
  .bars {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: #0b101c;
    border-bottom: 1px solid #1f2a40;
  }
  .bar {
    min-width: 0;
    font-size: 0.75rem;
  }
  .top {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    white-space: nowrap;
  }
  .name {
    font-weight: 600;
    font-size: 0.8125rem;
  }
  .state {
    color: #c3cbd9;
  }
  .symbol {
    display: inline-block;
    min-width: 1em;
    text-align: center;
    font-weight: 700;
    color: var(--status);
  }
  .track {
    height: 8px;
    margin: 0.2rem 0;
    border-radius: 4px;
    background: #222c40;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: 4px;
    background: var(--status);
    transition: width 0.2s;
  }
  .value {
    color: #a9b6cc;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .ok {
    --status: #0ca30c;
  }
  .tight {
    --status: #fab219;
  }
  .over {
    --status: #d03b3b;
  }
  .none {
    --status: #898781;
  }
  @media (max-width: 900px) {
    .bars {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.35rem 0.6rem;
      padding: 0.4rem 0.6rem;
    }
    .state {
      font-size: 0.6875rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .fill {
      transition: none;
    }
  }
</style>
