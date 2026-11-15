<script lang="ts">
  // Team play: create or join a room, see who looks after what, and talk.
  // Opened from the header as a dialog.
  import { ROLES } from '../net/messages.ts'
  import { game } from '../stores/game.svelte.ts'
  import { fillTemplate, uiText } from '../strings/en.ts'

  const text = uiText.team
  let dialog: HTMLDialogElement
  let code = $state('')
  let draft = $state('')
  let copied = $state(false)
  let busy = $state(false)

  let room = $derived(game.room)
  let errorText = $derived(
    game.roomError === null
      ? null
      : ((text.errors as Record<string, string>)[game.roomError] ?? text.errors.unknown),
  )

  function open() {
    dialog.showModal()
    game.markChatRead()
  }
  // While the panel is open, new chat lines count as read.
  $effect(() => {
    if (room && room.unread > 0 && dialog?.open) game.markChatRead()
  })

  async function run(action: () => Promise<void>) {
    busy = true
    await action()
    busy = false
  }
  function send(message: string) {
    game.chat(message)
    draft = ''
  }
  async function copy() {
    if (!room) return
    try {
      await navigator.clipboard.writeText(room.code)
      copied = true
      setTimeout(() => (copied = false), 2000)
    } catch {
      // No clipboard access: the code is on screen to read out.
    }
  }
</script>

<button type="button" class="opener" class:in-room={room !== null} onclick={open}>
  {room ? fillTemplate(text.openInRoom, { code: room.code, count: room.players.length }) : text.open}
  {#if room && room.unread > 0}
    <span class="unread">{fillTemplate(text.unread, { count: room.unread })}</span>
  {/if}
</button>

<dialog bind:this={dialog} aria-labelledby="team-title">
  <div class="head">
    <h2 id="team-title">{text.title}</h2>
    <button type="button" onclick={() => dialog.close()}>{text.close}</button>
  </div>

  {#if errorText}<p class="error" role="alert"><span aria-hidden="true">!</span> {errorText}</p>{/if}

  {#if !room}
    <p>{text.intro}</p>
    <label class="field">
      <span>{text.nameLabel}</span>
      <input type="text" maxlength="24" autocomplete="nickname" bind:value={game.playerName} />
    </label>
    <button type="button" class="primary" disabled={busy} onclick={() => run(() => game.createRoom())}>{text.create}</button>
    <form
      onsubmit={(event) => {
        event.preventDefault()
        run(() => game.joinRoom(code))
      }}
    >
      <p class="note">{text.or}</p>
      <div class="row">
        <label class="field">
          <span>{text.codeLabel}</span>
          <input type="text" class="code" maxlength="5" autocapitalize="characters" autocomplete="off" bind:value={code} />
        </label>
        <button type="submit" disabled={busy || code.trim().length !== 5}>{text.join}</button>
      </div>
    </form>
    <dl class="roles">
      {#each ROLES as role (role)}
        <div><dt>{text.roles[role].name}</dt><dd>{text.roles[role].text}</dd></div>
      {/each}
    </dl>
  {:else}
    <div class="share">
      <span>{text.codeHelp}</span>
      <strong class="code">{room.code}</strong>
      <button type="button" onclick={copy}>{copied ? text.copied : text.copy}</button>
    </div>
    <p class="note" role="status">{text.status[room.status]}</p>

    <h3>{text.playersTitle}</h3>
    <ul class="players">
      {#each room.players as player (player.id)}
        <li>
          <span class="name">{player.name}{player.id === room.me ? ` (${text.you})` : ''}</span>
          <span class="ready"><span aria-hidden="true">{player.ready ? '✓' : '…'}</span> {player.ready ? text.ready : text.notReady}</span>
          <span class="held">{player.roles.map((role) => text.roles[role].name).join(', ')}</span>
        </li>
      {/each}
    </ul>

    <h3>{text.chatTitle}</h3>
    <ol class="chat" aria-live="polite">
      {#each room.chat as line, index (index)}
        <li><strong>{line.name}:</strong> {line.text}</li>
      {:else}
        <li class="note">{text.chatEmpty}</li>
      {/each}
    </ol>
    <div class="quick">
      {#each text.quick as phrase (phrase)}
        <button type="button" onclick={() => send(phrase)}>{phrase}</button>
      {/each}
    </div>
    <form
      class="row"
      onsubmit={(event) => {
        event.preventDefault()
        send(draft)
      }}
    >
      <label class="field grow">
        <span class="visually-hidden">{text.chatLabel}</span>
        <input type="text" maxlength="280" placeholder={text.chatLabel} bind:value={draft} />
      </label>
      <button type="submit" disabled={draft.trim() === ''}>{text.send}</button>
    </form>

    <button type="button" class="leave" onclick={() => game.leaveRoom()}>{text.leave}</button>
  {/if}
</dialog>

<style>
  .opener {
    white-space: nowrap;
  }
  .opener.in-room {
    border-color: #7fd4ff;
  }
  .unread {
    margin-left: 0.4rem;
    padding: 0 0.4rem;
    border-radius: 999px;
    background: #7fd4ff;
    color: #05070d;
    font-size: 0.75rem;
    font-weight: 700;
  }
  dialog {
    box-sizing: border-box;
    width: min(30rem, calc(100vw - 1.5rem));
    max-height: calc(100dvh - 1.5rem);
    padding: 1rem;
    border: 1px solid #3a4963;
    border-radius: 12px;
    background: #0b101c;
    color: #eef2f8;
  }
  dialog[open] {
    display: grid;
    gap: 0.75rem;
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.6);
  }
  .head,
  .row,
  .share {
    display: flex;
    align-items: end;
    gap: 0.6rem;
  }
  .head {
    align-items: center;
    justify-content: space-between;
  }
  h2,
  h3,
  p {
    margin: 0;
  }
  h2 {
    font-size: 1.125rem;
  }
  h3 {
    font-size: 0.9375rem;
  }
  .note {
    color: #a9b6cc;
    font-size: 0.8125rem;
  }
  .error {
    padding: 0.4rem 0.6rem;
    border: 1px solid #d03b3b;
    border-left-width: 4px;
    border-radius: 8px;
    font-size: 0.875rem;
  }
  .field {
    display: grid;
    gap: 0.2rem;
    font-size: 0.8125rem;
  }
  .grow {
    flex: 1;
  }
  input[type='text'] {
    box-sizing: border-box;
    width: 100%;
    min-height: 2.5rem;
    padding: 0.3rem 0.6rem;
    border: 1px solid #3a4963;
    border-radius: 8px;
    background: #121a2b;
    color: inherit;
    font: inherit;
  }
  .code {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
  input.code {
    width: 8rem;
  }
  .share {
    align-items: center;
    flex-wrap: wrap;
  }
  .share .code {
    font-size: 1.5rem;
  }
  form {
    display: grid;
    gap: 0.4rem;
  }
  form.row {
    display: flex;
  }
  .roles {
    display: grid;
    gap: 0.3rem;
    margin: 0;
    font-size: 0.8125rem;
  }
  .roles div {
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.5rem;
  }
  dt {
    font-weight: 600;
  }
  dd {
    margin: 0;
    color: #a9b6cc;
  }
  .players,
  .chat {
    display: grid;
    gap: 0.3rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.875rem;
  }
  .players li {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0 0.75rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid #2a3650;
    border-radius: 8px;
    background: #0f1626;
  }
  .name {
    font-weight: 600;
  }
  .held {
    grid-column: 1 / -1;
    color: #a9b6cc;
    font-size: 0.8125rem;
  }
  .chat {
    max-height: 9rem;
    overflow-y: auto;
    padding: 0.4rem 0.6rem;
    border: 1px solid #2a3650;
    border-radius: 8px;
  }
  .quick {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .quick button {
    min-height: 2rem;
    padding: 0.1rem 0.6rem;
    border-radius: 999px;
    font-size: 0.8125rem;
  }
  .leave {
    justify-self: start;
  }
</style>
