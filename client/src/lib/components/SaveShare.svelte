<script lang="ts">
  // Save the current design on the server and show a link that opens it.
  import { designLink, saveDesign } from '../net/api.ts'
  import { game } from '../stores/game.svelte.ts'
  import { uiText } from '../strings/en.ts'

  const text = uiText.share
  let status = $state<'idle' | 'saving' | 'failed'>('idle')
  let link = $state<string | null>(null)
  let savedDesign = $state('')
  let copied = $state(false)

  // A changed design needs a new save: the old link shows the old design.
  let current = $derived(link !== null && savedDesign === JSON.stringify(game.design))

  async function save() {
    status = 'saving'
    try {
      const design = $state.snapshot(game.design)
      link = designLink(await saveDesign(game.scenarioId, design))
      savedDesign = JSON.stringify(design)
      status = 'idle'
    } catch {
      status = 'failed'
    }
  }
  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      copied = true
      setTimeout(() => (copied = false), 2000)
    } catch {
      // No clipboard access: the link is on screen to select.
    }
  }
</script>

<section class="share">
  <h3>{text.title}</h3>
  <div class="row">
    <button type="button" disabled={status === 'saving' || current} onclick={save}>
      {status === 'saving' ? text.saving : text.save}
    </button>
    {#if current && link}
      <button type="button" onclick={copy}>{copied ? text.copied : text.copy}</button>
    {/if}
  </div>
  {#if current && link}
    <p class="note" role="status">{text.saved}</p>
    <input type="text" readonly value={link} aria-label={text.title} onfocus={(event) => event.currentTarget.select()} />
  {:else if status === 'failed'}
    <p class="note" role="alert">{text.failed}</p>
  {/if}
</section>

<style>
  .share {
    display: grid;
    gap: 0.4rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  input {
    box-sizing: border-box;
    width: 100%;
    min-height: 2.25rem;
    padding: 0.2rem 0.5rem;
    border: 1px solid #3a4963;
    border-radius: 6px;
    background: #121a2b;
    color: inherit;
    font: 0.8125rem ui-monospace, 'SF Mono', Menlo, monospace;
  }
</style>
