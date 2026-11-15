<script lang="ts">
  // The pre-launch checks, problems first. Each says what is wrong and what
  // to change.
  import type { RoomPlayer } from '../net/messages.ts'
  import { CHECK_ROLES, holderOf } from '../net/roles.ts'
  import type { ConstraintCheck } from '../sim/types.ts'
  import { describeCheck, fillTemplate, uiText } from '../strings/en.ts'

  interface Props {
    checks: ConstraintCheck[]
    /** In a team: the players, so each problem can name who can fix it. */
    players?: RoomPlayer[]
  }
  let { checks, players }: Props = $props()

  /** "Spacecraft engineer (Ben), Science lead (Ada)" for a check, in a team. */
  function owners(check: ConstraintCheck): string | null {
    if (!players || players.length < 2) return null
    return CHECK_ROLES[check.id]
      .map((role) => `${uiText.team.roles[role].name} (${holderOf(role, players)?.name ?? '?'})`)
      .join(', ')
  }
  const text = uiText.verify
  const SYMBOL = { ok: '✓', risk: '!', blocked: '✕' } as const

  let problems = $derived(
    [...checks.filter((check) => check.status === 'blocked'), ...checks.filter((check) => check.status === 'risk')],
  )
  let passing = $derived(checks.filter((check) => check.status === 'ok'))
</script>

{#snippet item(check: ConstraintCheck)}
  {@const words = describeCheck(check)}
  <li class={check.status}>
    <div class="head">
      <span class="status"><span aria-hidden="true">{SYMBOL[check.status]}</span> {text.status[check.status]}</span>
      <span class="title">{words.title}</span>
    </div>
    <div class="text">{words.text}</div>
    {#if words.fix}<div class="fix"><strong>{text.fix}</strong> {words.fix}</div>{/if}
    {#if words.fix && owners(check)}
      <div class="owners">{fillTemplate(uiText.team.whoCanFix, { owners: owners(check) ?? '' })}</div>
    {/if}
  </li>
{/snippet}

{#if problems.length > 0}
  <h3>{text.problemsTitle}</h3>
  <ul>
    {#each problems as check (check.id)}{@render item(check)}{/each}
  </ul>
{/if}
{#if passing.length > 0}
  <details open={problems.length === 0}>
    <summary>{text.okTitle} ({passing.length})</summary>
    <ul>
      {#each passing as check (check.id)}{@render item(check)}{/each}
    </ul>
  </details>
{/if}

<style>
  h3 {
    margin: 0 0 0.4rem;
    font-size: 0.9375rem;
  }
  ul {
    display: grid;
    gap: 0.4rem;
    margin: 0 0 0.75rem;
    padding: 0;
    list-style: none;
  }
  li {
    padding: 0.5rem 0.7rem;
    border: 1px solid #2a3650;
    border-left: 4px solid var(--status);
    border-radius: 8px;
    background: #0f1626;
    font-size: 0.8125rem;
  }
  .ok {
    --status: #0ca30c;
  }
  .risk {
    --status: #fab219;
  }
  .blocked {
    --status: #d03b3b;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: baseline;
  }
  .status {
    padding: 0 0.4rem;
    border: 1px solid var(--status);
    border-radius: 999px;
    font-size: 0.6875rem;
    font-weight: 700;
    white-space: nowrap;
  }
  .title {
    font-weight: 600;
    font-size: 0.875rem;
  }
  .text {
    margin-top: 0.2rem;
    color: #c3cbd9;
  }
  .fix,
  .owners {
    margin-top: 0.2rem;
  }
  .owners {
    color: #dfe6f1;
    font-weight: 600;
  }
  summary {
    margin-bottom: 0.4rem;
    cursor: pointer;
    font-weight: 600;
  }
  summary:focus-visible {
    outline: 2px solid #7fd4ff;
    outline-offset: 2px;
  }
</style>
