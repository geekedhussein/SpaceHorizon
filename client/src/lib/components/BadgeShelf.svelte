<script lang="ts">
  // The header's badge counter, and the shelf it opens: every badge, earned
  // ones in colour, the rest greyed with how to earn them.
  import { BADGES } from '../game/rewards.ts'
  import { game } from '../stores/game.svelte.ts'
  import { fillTemplate, uiText } from '../strings/en.ts'

  const text = uiText.play.badgeShelf
  const badgeText = uiText.play.badges
  let dialog: HTMLDialogElement
  let earned = $derived(new Set(game.profile.badges))
</script>

<button
  type="button"
  class="opener"
  aria-label="{text.button} {fillTemplate(text.count, { earned: earned.size, total: BADGES.length })}"
  onclick={() => dialog.showModal()}
>
  <span aria-hidden="true">🏅</span>
  <span class="word">{text.button}</span>
  <span class="count">{fillTemplate(text.count, { earned: earned.size, total: BADGES.length })}</span>
</button>

<dialog bind:this={dialog} class="shelf" aria-labelledby="shelf-title">
  <h2 id="shelf-title">{text.title}</h2>
  <p class="note">{text.intro}</p>
  <ul>
    {#each BADGES as id (id)}
      {@const has = earned.has(id)}
      <li class:has>
        <span class="icon" aria-hidden="true">{badgeText[id].icon}</span>
        <span class="words">
          <strong>{badgeText[id].name}</strong>
          <span>{badgeText[id].text}</span>
        </span>
        <span class="state">{has ? text.earned : text.locked}</span>
      </li>
    {/each}
  </ul>
  <button type="button" class="close" onclick={() => dialog.close()}>{text.close}</button>
</dialog>

<style>
  .opener {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    white-space: nowrap;
  }
  .count {
    font-family: var(--display-font);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: #ffd166;
  }
  .shelf {
    box-sizing: border-box;
    width: min(34rem, calc(100vw - 1.5rem));
    max-height: calc(100dvh - 1.5rem);
    padding: 1.1rem 1.2rem;
    border: 1px solid #3a4963;
    border-radius: 16px;
    background: linear-gradient(180deg, #111a2e, #0a0f1b);
    color: #eef2f8;
    overflow-y: auto;
  }
  .shelf::backdrop {
    background: rgba(3, 5, 10, 0.72);
    backdrop-filter: blur(3px);
  }
  h2 {
    margin: 0;
    font-family: var(--display-font);
    font-size: 1.35rem;
  }
  .note {
    margin: 0.2rem 0 0.8rem;
    color: #a9b6cc;
    font-size: 0.8125rem;
  }
  ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.1rem 0.6rem;
    align-items: center;
    padding: 0.55rem 0.65rem;
    border: 1px solid #222c40;
    border-radius: 10px;
    background: #0f1626;
    font-size: 0.8125rem;
  }
  li:not(.has) {
    color: #8d99ad;
  }
  li:not(.has) .icon {
    filter: grayscale(1);
    opacity: 0.4;
  }
  li.has {
    border-color: rgba(255, 209, 102, 0.5);
    background: linear-gradient(135deg, rgba(255, 209, 102, 0.1), #0f1626 60%);
  }
  .icon {
    grid-row: span 2;
    font-size: 1.7rem;
  }
  .words {
    display: grid;
  }
  .state {
    grid-column: 2;
    font-size: 0.6875rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  li.has .state {
    color: #ffd166;
  }
  .close {
    margin-top: 0.9rem;
  }
  @media (max-width: 1500px) {
    .word {
      display: none;
    }
  }
</style>
