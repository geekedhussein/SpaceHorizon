<script lang="ts">
  // The tutorial's coach card. It sits over the 3D picture, points at the part
  // of the screen each step is about, and never takes the keyboard focus.
  import { tick, untrack } from 'svelte'
  import { game } from '../stores/game.svelte.ts'
  import { tutorial } from '../stores/tutorial.svelte.ts'
  import { elsewhere, TUTORIAL_STEPS } from '../tutorial/steps.ts'
  import { fillTemplate, uiText } from '../strings/en.ts'

  const text = uiText.tutorial
  const HIGHLIGHT = 'tour-target'

  let step = $derived(tutorial.step)
  let words = $derived(text.steps[step.id])
  let away = $derived(elsewhere(step, game.phase))
  let reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  // Move on by itself when the player does what the step asks. Only a change
  // in the game triggers this, so Back can return to a step already done.
  $effect(() => {
    void tutorial.state
    if (untrack(() => tutorial.active)) untrack(() => tutorial.settle())
  })

  // Point at the step's part of the screen. It may appear only after the game
  // step changes or the mission flies, so look again when those change.
  $effect(() => {
    const target = tutorial.active && !tutorial.hidden && !away ? step.target : null
    void game.phase
    void game.result
    if (target === null) return
    let element: Element | null = null
    let cancelled = false
    tick().then(() => {
      if (cancelled) return
      element = document.querySelector(`[data-tour="${target}"]`)
      element?.classList.add(HIGHLIGHT)
      element?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' })
    })
    return () => {
      cancelled = true
      element?.classList.remove(HIGHLIGHT)
    }
  })
</script>

{#if tutorial.active}
  {#if tutorial.hidden}
    <button type="button" class="pill" onclick={() => (tutorial.hidden = false)}>
      {text.show} · {fillTemplate(text.progress, { step: tutorial.index + 1, total: TUTORIAL_STEPS.length })}
    </button>
  {:else}
    <aside class="coach" aria-label={text.label} aria-live="polite">
      <div class="top">
        <span class="progress">{fillTemplate(text.progress, { step: tutorial.index + 1, total: TUTORIAL_STEPS.length })}</span>
        <button type="button" class="link" onclick={() => (tutorial.hidden = true)}>{text.hide}</button>
      </div>
      <h3>{words.title}</h3>
      <p>{words.text}</p>
      {#if away && step.phase}
        <p class="note">{fillTemplate(text.elsewhere, { phase: uiText.phases[step.phase].name })}</p>
        {#if step.phase !== 'operate' || game.result}
          <button type="button" onclick={() => step.phase && game.go(step.phase)}>
            {fillTemplate(text.goTo, { phase: uiText.phases[step.phase].name })}
          </button>
        {/if}
      {:else if step.done}
        <p class="note">{text.doThis}</p>
      {/if}
      <div class="buttons">
        <button type="button" class="link" onclick={() => tutorial.stop()}>{text.skip}</button>
        <span>
          <button type="button" disabled={tutorial.index === 0} onclick={() => tutorial.back()}>{text.back}</button>
          <button type="button" class="primary" onclick={() => tutorial.next()}>
            {tutorial.isLast ? text.finish : text.next}
          </button>
        </span>
      </div>
    </aside>
  {/if}
{/if}

<style>
  /* Top right, under the picture switch: both 3D scenes keep that space free. */
  .coach,
  .pill {
    position: absolute;
    top: 3.9rem;
    right: 0.75rem;
    z-index: 4;
  }
  .coach {
    display: grid;
    gap: 0.45rem;
    box-sizing: border-box;
    width: min(26rem, calc(100% - 2rem));
    padding: 0.8rem 0.9rem;
    border: 1px solid #c4a7ff;
    border-radius: 10px;
    background: #0b101c;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5);
  }
  .pill {
    border-color: #c4a7ff;
    background: #0b101c;
    white-space: nowrap;
  }
  .top,
  .buttons {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .buttons span {
    display: flex;
    gap: 0.4rem;
  }
  .progress {
    color: #c4a7ff;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.45;
  }
  .note {
    color: #c3cbd9;
    font-size: 0.8125rem;
  }
  .link {
    min-height: 0;
    padding: 0.2rem 0.3rem;
    border: 0;
    background: none;
    color: #a9b6cc;
    text-decoration: underline;
  }
  /* The part of the screen the step is about. */
  :global(.tour-target) {
    outline: 3px solid #c4a7ff;
    outline-offset: 3px;
    border-radius: 8px;
  }

  /* Phone: the picture is small, so the card sits at the bottom of the screen. */
  @media (max-width: 900px) {
    .coach,
    .pill {
      position: fixed;
      top: auto;
      right: 0.5rem;
      bottom: 0.5rem;
      z-index: 20;
    }
    .coach {
      width: calc(100% - 1rem);
      max-height: 45dvh;
      overflow-y: auto;
    }
    /* Room under the panel, so its last buttons can scroll clear of the card. */
    :global(body:has(.coach) #panel) {
      padding-bottom: 47dvh;
    }
  }
</style>
