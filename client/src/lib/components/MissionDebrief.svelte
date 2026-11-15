<script lang="ts">
  // The card at the end of a mission: stars for the three objectives, the score
  // counting up, each requirement ticked or crossed, badges and a best score.
  // Confetti for a full success. Every figure comes from the simulation result;
  // this card only presents it.
  import { onMount } from 'svelte'
  import type { Rewards } from '../game/rewards.ts'
  import { sound } from '../game/sound.ts'
  import type { Scenario, SimulationResult } from '../sim/types.ts'
  import { fillTemplate, uiText } from '../strings/en.ts'
  import Confetti from './Confetti.svelte'

  interface Props {
    result: SimulationResult
    rewards: Rewards | null
    scenario: Scenario
    /** In a team, "fly again" goes back to Verify, where everyone confirms. */
    team: boolean
    canRelaunch: boolean
    onclose: () => void
    onimprove: () => void
    onagain: () => void
  }
  let { result, rewards, scenario, team, canRelaunch, onclose, onimprove, onagain }: Props = $props()

  const text = uiText.play.debrief
  const badgeText = uiText.play.badges
  const STAR_DELAY_MS = 450
  const COUNT_MS = 1300

  let dialog: HTMLDialogElement
  let reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  let stars = $derived(rewards?.stars ?? [])
  let starCount = $derived(stars.filter((star) => star.earned).length)
  let success = $derived(starCount === 3)

  let title = $derived.by(() => {
    const status = result.outcome.status
    if (status === 'completed') return success ? text.titles.success : text.titles.completed
    if (status === 'launch_failed' || status === 'not_launched') return text.titles[status]
    return text.titles.over
  })

  // The reveal: stars one by one, the score counting up, then the finale.
  let shownStars = $state(0)
  let shownScore = $state(0)
  let celebrate = $state(false)

  onMount(() => {
    dialog.showModal()
    const total = result.score.total
    if (reduceMotion) {
      shownStars = stars.length
      shownScore = total
      return
    }
    const timers: ReturnType<typeof setTimeout>[] = []
    stars.forEach((star, index) => {
      timers.push(
        setTimeout(() => {
          shownStars = index + 1
          if (star.earned) sound.star(index)
        }, 300 + index * STAR_DELAY_MS),
      )
    })
    const start = performance.now()
    let frame = requestAnimationFrame(function count(now) {
      const t = Math.min(1, (now - start) / COUNT_MS)
      shownScore = total * (1 - (1 - t) ** 3)
      if (t < 1) frame = requestAnimationFrame(count)
    })
    timers.push(
      setTimeout(
        () => {
          if (success) {
            celebrate = true
            sound.success()
          } else if (starCount < 2) sound.failure()
          if ((rewards?.newBadges.length ?? 0) > 0) setTimeout(() => sound.badge(), 700)
        },
        300 + stars.length * STAR_DELAY_MS,
      ),
    )
    return () => {
      timers.forEach(clearTimeout)
      cancelAnimationFrame(frame)
    }
  })

  function close() {
    dialog.close()
  }
</script>

<dialog
  bind:this={dialog}
  class="debrief"
  class:success
  class:failed={starCount < 2}
  aria-labelledby="debrief-title"
  onclose={onclose}
>
  {#if celebrate}<Confetti ondone={() => (celebrate = false)} />{/if}
  <ol class="stars" aria-label={fillTemplate(text.stars, { count: starCount })}>
    {#each stars as star, index (star.id)}
      <li class:earned={star.earned} class:shown={index < shownStars}>
        <span class="star" aria-hidden="true">★</span>
        <span class="goal">{fillTemplate(text.starGoals[star.id], { years: scenario.planned_lifetime_years })}</span>
        <span class="visually-hidden">{star.earned ? uiText.requirements.met : uiText.requirements.notMet}</span>
      </li>
    {/each}
  </ol>
  <h2 id="debrief-title">{title}</h2>
  <p class="outcome">{uiText.operate.statuses[result.outcome.status]}</p>

  <div class="score">
    <span class="score-label">{text.score}</span>
    <span class="score-value">{Math.round(shownScore)}</span>
    <span class="score-max">/ 100</span>
  </div>
  {#if rewards?.counted}
    {#if rewards.newBest}
      <p class="best new"><span aria-hidden="true">▲</span> {text.newBest}</p>
    {:else if rewards.previousBest !== null}
      <p class="best">{fillTemplate(text.best, { points: Math.round(rewards.previousBest) })}</p>
    {/if}
  {:else if rewards}
    <p class="best">{text.sandbox}</p>
  {/if}


  <h3>{text.objectives}</h3>
  <ul class="requirements">
    {#each result.requirements as entry, index (entry.id)}
      {@const requirement = scenario.requirements.find((item) => item.id === entry.id)}
      <li class:met={entry.met} style:animation-delay="{reduceMotion ? 0 : 600 + index * 150}ms">
        <span class="mark" aria-hidden="true">{entry.met ? '✓' : '✕'}</span>
        <span>{requirement?.label ?? entry.id}</span>
        <span class="visually-hidden">{entry.met ? uiText.requirements.met : uiText.requirements.notMet}</span>
      </li>
    {/each}
  </ul>

  {#if rewards?.counted}
    <h3>{text.badges}</h3>
    {#if rewards.earned.length > 0}
      <ul class="badges">
        {#each rewards.earned as id (id)}
          {@const isNew = rewards.newBadges.includes(id)}
          <li class:new={isNew} title={badgeText[id].text}>
            <span class="icon" aria-hidden="true">{badgeText[id].icon}</span>
            {badgeText[id].name}
            {#if isNew}<strong class="tag">{text.newBadge}</strong>{/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="note">{text.noBadges}</p>
    {/if}
  {/if}

  <div class="actions">
    <button type="button" onclick={close}>{text.report}</button>
    <button type="button" onclick={() => (close(), onimprove())}>{text.improve}</button>
    {#if team}
      <button type="button" class="primary" onclick={() => (close(), onagain())}>{text.verify}</button>
    {:else}
      <button type="button" class="primary" disabled={!canRelaunch} onclick={() => (close(), onagain())}>{text.again}</button>
    {/if}
  </div>
</dialog>

<style>
  .debrief {
    box-sizing: border-box;
    width: min(30rem, calc(100vw - 1.5rem));
    max-height: calc(100dvh - 1.5rem);
    padding: 1.25rem 1.25rem 1rem;
    border: 1px solid #3a4963;
    border-radius: 16px;
    background:
      radial-gradient(circle at 50% -10%, var(--glow), transparent 60%),
      linear-gradient(180deg, #111a2e, #0a0f1b);
    color: #eef2f8;
    box-shadow:
      0 0 0 1px rgba(127, 212, 255, 0.08),
      0 24px 60px rgba(0, 0, 0, 0.6);
    text-align: center;
    overflow-y: auto;
    --glow: rgba(127, 212, 255, 0.22);
    --accent: #7fd4ff;
  }
  .debrief[open] {
    animation: enter 0.45s cubic-bezier(0.2, 1.3, 0.4, 1);
  }
  .success {
    --glow: rgba(255, 209, 102, 0.3);
    --accent: #ffd166;
    border-color: rgba(255, 209, 102, 0.6);
  }
  .failed {
    --glow: rgba(208, 59, 59, 0.22);
    --accent: #ff8a8a;
  }
  .debrief::backdrop {
    background: rgba(3, 5, 10, 0.72);
    backdrop-filter: blur(3px);
  }
  .stars {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .stars li {
    display: grid;
    justify-items: center;
    align-content: start;
    gap: 0.15rem;
    opacity: 0;
    transform: scale(0.4);
    transition:
      transform 0.35s cubic-bezier(0.2, 1.6, 0.4, 1),
      opacity 0.2s;
  }
  .stars li.shown {
    opacity: 1;
    transform: scale(1);
  }
  .star {
    font-size: 2.5rem;
    line-height: 1;
    color: #2a3650;
  }
  .stars li:nth-child(2) .star {
    font-size: 3.1rem;
    margin-top: -0.3rem;
  }
  .earned .star {
    color: #ffd166;
    text-shadow: 0 0 18px rgba(255, 209, 102, 0.7);
  }
  .goal {
    color: #8d99ad;
    font-size: 0.6875rem;
    line-height: 1.25;
  }
  .earned .goal {
    color: #e6edf7;
  }
  h2 {
    margin: 0.5rem 0 0.1rem;
    font-family: var(--display-font);
    font-size: 1.7rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: var(--accent);
  }
  .outcome {
    margin: 0;
    color: #c3cbd9;
    font-size: 0.875rem;
  }
  .score {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.4rem;
    margin-top: 0.4rem;
    font-family: var(--display-font);
  }
  .score-label {
    color: #a9b6cc;
    font-size: 0.8rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
  .score-value {
    font-size: 3rem;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .score-max {
    color: #a9b6cc;
  }
  .best {
    margin: 0.2rem 0 0;
    color: #c3cbd9;
    font-size: 0.8125rem;
  }
  .best.new {
    color: #ffd166;
    font-weight: 700;
    animation: pulse 1.2s ease-in-out 3;
  }
  h3 {
    margin: 0.75rem 0 0.3rem;
    color: #a9b6cc;
    font-family: var(--display-font);
    font-size: 0.75rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  ul {
    display: grid;
    gap: 0.3rem;
    margin: 0;
    padding: 0;
    list-style: none;
    text-align: left;
  }
  .requirements li {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.25rem 0.6rem;
    border: 1px solid #222c40;
    border-radius: 8px;
    background: rgba(15, 22, 38, 0.8);
    font-size: 0.8125rem;
  }
  .requirements li {
    animation: slide 0.35s ease-out both;
  }
  .mark {
    flex: none;
    width: 1.1em;
    font-weight: 800;
    text-align: center;
  }
  .requirements li.met .mark {
    color: #0ca30c;
  }
  .requirements li:not(.met) .mark {
    color: #d03b3b;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.4rem;
  }
  .badges li {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.6rem;
    border: 1px solid #3a4963;
    border-radius: 999px;
    background: #121a2b;
    font-size: 0.8125rem;
  }
  .badges li.new {
    border-color: #c4a7ff;
    box-shadow: 0 0 14px rgba(196, 167, 255, 0.45);
  }
  .tag {
    color: #c4a7ff;
    font-size: 0.6875rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .note {
    margin: 0;
    color: #a9b6cc;
    font-size: 0.8125rem;
  }
  /* The buttons stay in view even when the card scrolls. */
  .actions {
    position: sticky;
    bottom: -1rem;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    margin: 1rem -1.25rem -1rem;
    padding: 0.7rem 1rem 0.9rem;
    border-top: 1px solid #222c40;
    background: #0a0f1b;
  }
  @keyframes enter {
    from {
      transform: translateY(24px) scale(0.92);
      opacity: 0;
    }
  }
  @keyframes slide {
    from {
      transform: translateX(-10px);
      opacity: 0;
    }
  }
  @keyframes pulse {
    50% {
      text-shadow: 0 0 16px rgba(255, 209, 102, 0.9);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .debrief[open],
    .requirements li,
    .best.new {
      animation: none;
    }
    .stars li {
      transition: none;
    }
  }
</style>
