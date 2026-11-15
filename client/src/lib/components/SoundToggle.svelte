<script lang="ts">
  // Turns the game's sound effects on and off. The choice is remembered.
  import { isMuted, setMuted, sound } from '../game/sound.ts'
  import { uiText } from '../strings/en.ts'

  const text = uiText.play.sound
  let on = $state(!isMuted())

  function toggle() {
    on = !on
    setMuted(!on)
    if (on) sound.select()
  }
</script>

<button type="button" class="sound" aria-pressed={on} aria-label={text.label} title={on ? text.on : text.off} onclick={toggle}>
  <span aria-hidden="true">{on ? '🔊' : '🔇'}</span>
</button>

<style>
  .sound {
    padding-inline: 0.6rem;
  }
</style>
