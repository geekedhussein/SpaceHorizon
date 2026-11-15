<script lang="ts">
  // The six mission steps. The player can move between them freely; only the
  // last one waits for a launch.
  import { PHASES } from '../stores/game.svelte.ts'
  import type { Phase } from '../stores/game.svelte.ts'
  import { uiText } from '../strings/en.ts'

  interface Props {
    phase: Phase
    canOperate: boolean
    onselect: (phase: Phase) => void
  }
  let { phase, canOperate, onselect }: Props = $props()
</script>

<nav aria-label={uiText.phaseNavLabel}>
  <ol>
    {#each PHASES as id, index (id)}
      {@const locked = id === 'operate' && !canOperate}
      <li>
        <button
          type="button"
          class:current={id === phase}
          aria-current={id === phase ? 'step' : undefined}
          disabled={locked}
          title={locked ? uiText.phaseLocked : uiText.phases[id].step}
          onclick={() => onselect(id)}
        >
          <span class="number" aria-hidden="true">{index + 1}</span>
          <span class="name">{uiText.phases[id].name}</span>
        </button>
      </li>
    {/each}
  </ol>
</nav>

<style>
  ol {
    display: flex;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow-x: auto;
  }
  button {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.25rem;
    padding: 0.2rem 0.6rem;
    border: 1px solid transparent;
    border-radius: 999px;
    background: none;
    color: #c3cbd9;
    font: inherit;
    font-size: 0.875rem;
    white-space: nowrap;
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    background: #1b2740;
  }
  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  button:focus-visible {
    outline: 2px solid #7fd4ff;
    outline-offset: 1px;
  }
  .number {
    display: grid;
    place-items: center;
    width: 1.4rem;
    height: 1.4rem;
    border: 1px solid currentColor;
    border-radius: 50%;
    font-size: 0.75rem;
  }
  .current {
    border-color: #7fd4ff;
    background: #14233c;
    color: #fff;
    font-weight: 600;
  }
  .current .number {
    background: #7fd4ff;
    border-color: #7fd4ff;
    color: #05070d;
  }
  @media (max-width: 700px) {
    button:not(.current) .name {
      display: none;
    }
    button {
      padding: 0.2rem 0.35rem;
    }
  }
</style>
