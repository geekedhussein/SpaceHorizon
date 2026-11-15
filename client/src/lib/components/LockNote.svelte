<script lang="ts">
  // In a team: says whose choice a group of options is, when it is not yours.
  import type { RoomPath } from '../net/roles.ts'
  import { game } from '../stores/game.svelte.ts'
  import { fillTemplate, uiText } from '../strings/en.ts'

  interface Props {
    path: RoomPath
  }
  let { path }: Props = $props()
  let lock = $derived(game.lockedBy(path))
</script>

{#if lock}
  <p class="lock">
    <span aria-hidden="true">🔒</span>
    {fillTemplate(uiText.team.locked, { role: uiText.team.roles[lock.role].name, name: lock.name })}
  </p>
{/if}

<style>
  .lock {
    margin: 0;
    padding: 0.3rem 0.6rem;
    border: 1px dashed #3a4963;
    border-radius: 8px;
    color: #dfe6f1;
    font-size: 0.8125rem;
  }
</style>
