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
  let current = $derived(PHASES.indexOf(phase))
</script>

<nav aria-label={uiText.phaseNavLabel}>
  <ol>
    {#each PHASES as id, index (id)}
      {@const locked = id === 'operate' && !canOperate}
      {@const done = index < current}
      <li class:done class:here={id === phase}>
        <button
          type="button"
          class:current={id === phase}
          aria-current={id === phase ? 'step' : undefined}
          disabled={locked}
          title={locked ? uiText.phaseLocked : uiText.phases[id].step}
          onclick={() => onselect(id)}
        >
          <span class="number" aria-hidden="true">{done ? '✓' : index + 1}</span>
          <span class="name">{uiText.phases[id].name}</span>
        </button>
      </li>
    {/each}
  </ol>
</nav>

<style>
  ol {
    display: flex;
    align-items: center;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow-x: auto;
  }
  li {
    display: flex;
    align-items: center;
  }
  /* The track between steps: lit up to the current step. */
  li + li::before {
    content: '';
    width: 0.9rem;
    height: 2px;
    margin: 0 0.1rem;
    border-radius: 1px;
    background: #2a3650;
  }
  li.done + li::before,
  li.done::before,
  li.here::before {
    background: linear-gradient(90deg, #3fb8f5, #7fd4ff);
    box-shadow: 0 0 6px rgba(127, 212, 255, 0.6);
  }
  button {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.25rem;
    padding: 0.2rem 0.6rem 0.2rem 0.25rem;
    border: 1px solid transparent;
    border-radius: 999px;
    background: none;
    color: #a9b6cc;
    font-family: var(--display-font);
    font-size: 0.875rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;
  }
  button:hover:not(:disabled) {
    background: #1b2740;
    color: #fff;
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
    width: 1.55rem;
    height: 1.55rem;
    border: 1.5px solid #3a4963;
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: 800;
  }
  .done button {
    color: #cfe9ff;
  }
  .done .number {
    border-color: #3fb8f5;
    background: rgba(63, 184, 245, 0.18);
    color: #7fd4ff;
  }
  .current {
    border-color: rgba(127, 212, 255, 0.6);
    background: linear-gradient(180deg, #1a2d4c, #12203a);
    box-shadow: 0 0 14px rgba(127, 212, 255, 0.25);
    color: #fff;
  }
  .current .number {
    border-color: #7fd4ff;
    background: #7fd4ff;
    color: #05070d;
    box-shadow: 0 0 10px rgba(127, 212, 255, 0.8);
  }
  /* Too narrow for six names: only the current step keeps its name. Between
     these widths the header gives the track a row of its own. */
  @media (max-width: 700px), (min-width: 901px) and (max-width: 1180px) {
    button:not(.current) .name {
      display: none;
    }
    button {
      padding: 0.2rem 0.35rem;
    }
    li + li::before {
      width: 0.5rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
  }
</style>
