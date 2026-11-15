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

  /** Line icons, drawn on a 24-unit grid with the text colour. */
  const ICON: Record<ResourceBar['id'], string> = {
    mass: 'M9 8a3 3 0 1 1 6 0 M6.5 8h11l2 12h-15z',
    power: 'M13 2 5 13.5h6L10 22l9-12h-6.5z',
    budget: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 6.5v11 M15 9h-4.2a1.8 1.8 0 0 0 0 3.6h2.4a1.8 1.8 0 0 1 0 3.6H9',
    data: 'M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3z M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6 M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3',
    comms: 'M12 21v-9 M12 12a1.5 1.5 0 1 0 0-.01 M8.2 8.2a5.4 5.4 0 0 1 7.6 0 M5.3 5.3a9.5 9.5 0 0 1 13.4 0',
    time: 'M7 3h10 M7 21h10 M8 3c0 5 8 5 8 9s-8 4-8 9 M16 3c0 5-8 5-8 9s8 4 8 9',
  }

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
        <span class="name">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d={ICON[bar.id]} /></svg>
          {entry.name}
        </span>
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
    gap: 0.5rem 0.9rem;
    padding: 0.5rem 0.75rem 0.45rem;
    background: rgba(8, 12, 22, 0.94);
    border-bottom: 1px solid var(--line);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
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
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-family: var(--display-font);
    font-weight: 700;
    font-size: 0.8125rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .icon {
    width: 1rem;
    height: 1rem;
    flex: none;
    fill: none;
    stroke: var(--status);
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 3px var(--status));
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
    position: relative;
    height: 10px;
    margin: 0.25rem 0;
    border: 1px solid #263350;
    border-radius: 5px;
    background: #0f1626;
    overflow: hidden;
  }
  /* Tick marks every tenth, like a gauge. */
  .track::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), rgba(4, 6, 12, 0.7) calc(10% - 1px) 10%);
    pointer-events: none;
  }
  .fill {
    height: 100%;
    border-radius: 4px;
    background: linear-gradient(90deg, color-mix(in srgb, var(--status) 55%, #000), var(--status));
    box-shadow: 0 0 10px color-mix(in srgb, var(--status) 70%, transparent);
    transition: width 0.35s cubic-bezier(0.2, 1, 0.3, 1);
  }
  .over .track {
    border-color: color-mix(in srgb, var(--status) 60%, #263350);
    animation: alarm 1.4s ease-in-out infinite;
  }
  @keyframes alarm {
    50% {
      box-shadow: 0 0 10px color-mix(in srgb, var(--status) 80%, transparent);
    }
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
    .over .track {
      animation: none;
    }
  }
</style>
