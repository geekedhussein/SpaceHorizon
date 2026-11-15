<script lang="ts">
  // The seconds before liftoff: a short countdown over the whole game, naming
  // the real rocket and orbit. The result is already decided; this only builds
  // the moment. It can be skipped.
  import { catalog } from '../content/index.ts'
  import { game } from '../stores/game.svelte.ts'
  import { fillTemplate, uiText } from '../strings/en.ts'

  const text = uiText.play.countdown
  let orbit = $derived(catalog.orbits.find((entry) => entry.id === game.design.orbitId)?.name ?? '')
</script>

{#if game.countdown !== null}
  <div class="countdown" class:liftoff={game.countdown === 0} role="group" aria-label={text.label}>
    <div class="glow" aria-hidden="true"></div>
    <p class="vehicle">{fillTemplate(text.vehicle, { launcher: game.countdownLauncher, orbit })}</p>
    <div class="clock" aria-live="assertive">
      {#key game.countdown}
        {#if game.countdown > 0}
          <span class="label">{text.tMinus}</span>
          <span class="number">{game.countdown}</span>
        {:else}
          <span class="number go">{text.liftoff}</span>
        {/if}
      {/key}
    </div>
    <svg class="rocket" viewBox="0 0 40 120" aria-hidden="true">
      <defs>
        <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff6c8" />
          <stop offset="0.4" stop-color="#ffd166" />
          <stop offset="1" stop-color="#ff7a3d" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path class="flame" d="M13 82 Q20 120 27 82 Z" fill="url(#flame)" />
      <path d="M20 4 C28 14 30 30 30 46 V80 H10 V46 C10 30 12 14 20 4 Z" fill="#e8edf5" />
      <path d="M10 62 L3 82 H10 Z M30 62 L37 82 H30 Z" fill="#9fb3cf" />
      <circle cx="20" cy="36" r="4.5" fill="#3a4963" stroke="#7fd4ff" stroke-width="1.5" />
    </svg>
    <button type="button" class="skip" onclick={() => game.skipCountdown()}>{text.skip}</button>
  </div>
{/if}

<style>
  .countdown {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 0.75rem;
    background: radial-gradient(circle at 50% 60%, rgba(20, 35, 60, 0.9), rgba(3, 5, 10, 0.94));
    overflow: hidden;
  }
  .glow {
    position: absolute;
    left: 50%;
    bottom: -30vh;
    width: 70vh;
    height: 70vh;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 170, 80, 0.35), transparent 65%);
    transform: translateX(-50%) scale(0.4);
    opacity: 0;
    transition:
      transform 0.8s ease-out,
      opacity 0.8s;
  }
  .liftoff .glow {
    transform: translateX(-50%) scale(1.2);
    opacity: 1;
  }
  .vehicle {
    margin: 0;
    color: #a9b6cc;
    font-family: var(--display-font);
    font-size: 0.9rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .clock {
    display: grid;
    justify-items: center;
    min-height: 9rem;
  }
  .label {
    color: #7fd4ff;
    font-family: var(--display-font);
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.3em;
  }
  .number {
    font-family: var(--display-font);
    font-size: clamp(5rem, 18vw, 8rem);
    font-weight: 800;
    line-height: 1;
    color: #fff;
    text-shadow: 0 0 30px rgba(127, 212, 255, 0.7);
    animation: pop 0.85s ease-out both;
  }
  .go {
    font-size: clamp(3rem, 12vw, 5.5rem);
    color: #ffd166;
    text-shadow: 0 0 34px rgba(255, 170, 80, 0.8);
  }
  .rocket {
    width: 3rem;
    height: 9rem;
  }
  .flame {
    opacity: 0.25;
    transform-origin: 20px 82px;
    transform: scaleY(0.4);
  }
  .liftoff .rocket {
    animation: rise 1s ease-in forwards;
  }
  .liftoff .flame {
    opacity: 1;
    animation: flicker 0.08s infinite alternate;
  }
  .skip {
    position: absolute;
    right: 1rem;
    bottom: 1rem;
    min-height: 2.5rem;
    padding: 0.3rem 0.9rem;
    border: 1px solid #3a4963;
    border-radius: 8px;
    background: rgba(18, 26, 43, 0.8);
    color: #eef2f8;
    font: inherit;
    cursor: pointer;
  }
  @keyframes pop {
    from {
      transform: scale(1.8);
      opacity: 0;
    }
    25% {
      transform: scale(1);
      opacity: 1;
    }
    to {
      transform: scale(0.92);
      opacity: 0.85;
    }
  }
  @keyframes rise {
    to {
      transform: translateY(-80vh);
    }
  }
  @keyframes flicker {
    from {
      transform: scaleY(1);
    }
    to {
      transform: scaleY(1.25);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .number,
    .liftoff .rocket,
    .liftoff .flame {
      animation: none;
    }
    .glow {
      transition: none;
    }
  }
</style>
