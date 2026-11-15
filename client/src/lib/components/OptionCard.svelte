<script lang="ts">
  // One choice in a list: a part, an orbit, a launcher. A choice that cannot be
  // used is greyed out with its reason, never hidden.
  import type { Snippet } from 'svelte'
  import { uiText } from '../strings/en.ts'

  interface Props {
    type: 'radio' | 'checkbox'
    name: string
    title: string
    badge?: string
    description?: string
    why?: string
    facts?: string[]
    selected: boolean
    /** Why it cannot be chosen. A chosen item stays removable. */
    reason?: string | null
    /** In a team, another role's choice: shown, but not changeable. */
    locked?: boolean
    onselect: () => void
    /** Extra controls shown under a chosen card. */
    children?: Snippet
  }
  let {
    type,
    name,
    title,
    badge,
    description,
    why,
    facts = [],
    selected,
    reason = null,
    locked = false,
    onselect,
    children,
  }: Props = $props()
  let greyed = $derived(reason !== null && !selected)
  let disabled = $derived(locked || greyed)
</script>

<div class="card" class:selected class:disabled={greyed} class:locked>
  <label>
    <input {type} {name} checked={selected} {disabled} onchange={onselect} />
    <span class="text">
      <span class="head">
        <span class="title">{title}</span>
        {#if badge}<span class="badge">{badge}</span>{/if}
        {#if selected}<span class="chosen"><span aria-hidden="true">✓</span> {uiText.chosen}</span>{/if}
      </span>
      {#if description}<span class="line">{description}</span>{/if}
      {#if why}<span class="line why">{why}</span>{/if}
      {#if facts.length > 0}
        <span class="facts">
          {#each facts as fact (fact)}<span>{fact}</span>{/each}
        </span>
      {/if}
      {#if reason}<span class="line reason">{uiText.notAvailable} {reason}</span>{/if}
    </span>
  </label>
  {#if children && selected}
    <div class="extra">{@render children()}</div>
  {/if}
</div>

<style>
  .card {
    border: 1px solid #2a3650;
    border-radius: 8px;
    background: #0f1626;
  }
  .card:has(input:focus-visible) {
    outline: 2px solid #7fd4ff;
    outline-offset: 1px;
  }
  .selected {
    border-color: #7fd4ff;
    background: #13203a;
  }
  .disabled {
    border-style: dashed;
  }
  .disabled .title,
  .disabled .line:not(.reason),
  .disabled .facts {
    opacity: 0.5;
  }
  label {
    display: flex;
    gap: 0.6rem;
    padding: 0.6rem 0.7rem;
    cursor: pointer;
  }
  .disabled label,
  .locked label {
    cursor: not-allowed;
  }
  input {
    flex: none;
    width: 1.1rem;
    height: 1.1rem;
    margin: 0.15rem 0 0;
  }
  .text {
    display: grid;
    gap: 0.25rem;
    min-width: 0;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.5rem;
  }
  .title {
    font-weight: 600;
  }
  .badge,
  .chosen {
    padding: 0 0.4rem;
    border: 1px solid #3a4963;
    border-radius: 999px;
    color: #c3cbd9;
    font-size: 0.6875rem;
  }
  .chosen {
    border-color: #7fd4ff;
    color: #fff;
  }
  .line {
    color: #c3cbd9;
    font-size: 0.8125rem;
  }
  .why {
    color: #a9b6cc;
  }
  .reason {
    color: #fff;
    font-weight: 600;
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.4rem;
    font-size: 0.75rem;
  }
  .facts span {
    padding: 0 0.4rem;
    border-radius: 4px;
    background: #1c2740;
    color: #dfe6f1;
  }
  .extra {
    padding: 0 0.7rem 0.7rem 2.4rem;
  }
</style>
