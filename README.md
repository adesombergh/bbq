# grill-ui

An MCP server that gives Claude Code a browser UI for long grilling sessions
(the `grilling` skill: relentless, multi-round interrogation of a plan).

Terminal Q&A collapses under a long grilling: each question packs a lot of
information into few words and the rounds scroll away. grill-ui replaces that
with a local web app. Claude pushes rounds of questions into it; you answer
with buttons or free text, and for any question you can ask for a re-pitch
(**Wait what**), a visual (**Show me**) or a plain-language explainer (**ELI5**),
which open in a contextual panel on the right.

## Install

```sh
bun install          # server + ui deps
bun run build        # builds ui/dist once; the MCP server only serves it
```

Register the server in the project you grill from (or globally) — `.mcp.json`:

```json
{ "mcpServers": { "grill-ui": { "command": "bun", "args": ["run", "/path/to/grill-ui/src/mcp.ts"] } } }
```

Copy or symlink `skills/grill-ui` and `skills/show-me` where your skills live
(`.agents/skills`, `.claude/skills`…). `wait-what` and `eli5` are existing skills;
the tool results carry an inline brief so Claude can still answer asides when a
skill is missing.

Then: “grill me on X with the UI”.

## Try it without Claude

```sh
bun run demo   # plays Claude: opens the browser, pushes two rounds, answers asides
bun test
```

## Design

**Claude never talks to the browser.** Claude talks to state (`src/state.ts`);
state and the browser talk over WebSocket (`src/hub.ts`). The MCP tools
(`src/mcp.ts`) only read/mutate state and `waitFor` changes. That seam is the
whole design.

```
Claude ──MCP stdio──▶ src/mcp.ts ──▶ Store (src/state.ts) ◀── WS ── src/hub.ts ◀── browser (ui/)
```

### Tools

| tool | blocks? | purpose |
|---|---|---|
| `open_session({ title })` | until a tab connects (≤ `waitForBrowserMs`, default 30s) | start a session, open the browser |
| `ask_round({ sessionId, intro?, questions })` | no | publish one frontier round |
| `wait_for_answers({ sessionId, roundId, timeoutMs? })` | ≤ `timeoutMs` | poll; returns `answered` / `aside_requested` / `pending` / `closed` |
| `post_aside({ sessionId, asideId, format, content })` | no | deliver a Wait-what / Show-me / ELI5 result to the panel |
| `post_note({ sessionId, markdown })` | no | chat bubble between rounds |
| `close_session({ sessionId })` | no | mark the session finished |

### Polling contract

No tool ever blocks past its timeout. `wait_for_answers` waits at most
`timeoutMs` (default 55s via `GRILL_UI_WAIT_MS`, hard cap 280s: under Claude
Code's 5-minute MCP idle cutoff) and returns `pending` on timeout. Claude just
calls it again, so a round can sit open for an hour at the cost of one cheap
tool call per minute. Asides interrupt the wait immediately and are returned
before answers so the user is never left staring at a spinner.

### UI rules

- One question is active at a time; the first unanswered one on a new round.
- Question N unlocks once N-1 is answered. Any answer can be changed until the
  round is sent (click an answered question to reopen it).
- Answering advances to the next question. When all are answered, **Send
  answers to Claude** submits the round; the round then freezes.
- The active card shows three separated blocks: question, options
  (+ manual answer textarea), recommendation (+ *Go with recommendation*, and the
  three aside buttons).
- The right panel is per question, tabbed by aside kind, closable (Esc).
  `markdown` asides render as rich text; `html` asides render in a sandboxed
  frame (no scripts).

### Hard constraints honored

1. stdout belongs to MCP; every log is `console.error`. The server never spawns
   a build tool or dev server.
2. The UI is prebuilt; `src/mcp.ts` serves `ui/dist` and shows a placeholder
   page if it is missing. Startup is instant.
3. `idleTimeout: 0` on `Bun.serve` and on the WS handler.
4. Polling contract above.
5. Binds `127.0.0.1:0`. Every request needs the per-process token: `?token=` on
   the first navigation, persisted as an HttpOnly cookie for assets and the WS.

## Layout

```
src/mcp.ts      MCP entry (stdio) + tools
src/state.ts    Store: sessions, rounds, answers, asides, notes, waitFor
src/hub.ts      Bun.serve: static ui/dist, WS relay, token auth
src/browser.ts  open the default browser without touching stdio
src/types.ts    shared types (also imported by the UI)
ui/             Vite + React + Tailwind v4, builds to ui/dist
scripts/demo.ts fake Claude for manual testing
skills/         grill-ui (protocol for Claude) and show-me
test/           bun tests for state and hub
```

Env: `GRILL_UI_WAIT_MS` default poll length, `GRILL_UI_NO_OPEN=1` to not launch a browser.
