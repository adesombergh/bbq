# bbq 🔥🍖

**Don’t grill your brain.**

A browser UI for Claude Code grilling sessions.

Long grilling sessions are cognitively expensive: code-heavy questions are
information-dense, while the terminal mixes questions, options,
recommendations, and answers into one scrolling stream.

bbq moves grilling into a dedicated UI. Questions, choices, context, and
follow-ups are structured and easy to scan, so you can spend your attention on
the decisions—not on parsing the conversation.

It is an MCP server plus a `bbq` skill that runs the `grilling` skill (a
relentless, multi-round interrogation of a plan) in the browser. Claude pushes
rounds of questions into it; you answer with buttons or free text, and on any
question you can ask for a re-pitch (**Wait what**), a visual (**Show me**,
which may come back as a diagram) or a plain-language explainer (**ELI5**),
which open in a contextual panel on the right.

![A round in the browser: question, options, recommendation, and a diagram in the side panel](https://raw.githubusercontent.com/adesombergh/bbq/main/docs/screenshot.png)

## Install

bbq needs [Bun](https://bun.sh) 1.4 or newer; the server is built on
`Bun.serve`. The browser UI comes prebuilt inside the `bbq-mcp` package, so
there is nothing to build.

### As a Claude Code plugin (server + skills in one go)

```
/plugin marketplace add adesombergh/bbq
/plugin install bbq-mcp@bbq
```

That registers the MCP server (pinned to the plugin's version) and installs
the `bbq` skill plus its `barbecue` and `churrasco` aliases, and `bbq-offload`,
namespaced as plugin skills are: `/bbq-mcp:bbq`, `/bbq-mcp:barbecue`,
`/bbq-mcp:churrasco`, `/bbq-mcp:bbq-offload`. Then: "grill me on X with the UI",
or `/bbq-mcp:bbq`.

### As a plain MCP server

Add to `.mcp.json` in the project you grill from, or to your user-level config:

```json
{
  "mcpServers": {
    "bbq-mcp": {
      "command": "bunx",
      "args": ["bbq-mcp"]
    }
  }
}
```

Then copy or symlink `skills/bbq` from this repo where your skills live
(`.agents/skills`, `.claude/skills`…), and `skills/barbecue` and
`skills/churrasco` beside it if you want those words to work too — they are
short stubs that invoke `bbq`, because skill frontmatter has no `aliases` field
(`docs/adr/0018-aliases-are-stub-skills.md`). Add `skills/bbq-offload` too if you
want to answer other skills' questions in the browser.

### Optional aside skills

Two of the three aside kinds can call an aside skill, both third party and both
optional:

```sh
npx skills add humanlayer/skills --skill show-me   # Show me
/plugin install eli5@claude-community              # ELI5
```

**Wait, what?** has no skill: the one of that name in `mattpocock-skills` is
`disable-model-invocation`, a slash command for you rather than something Claude
can invoke, so its brief is the implementation.

Nothing here is required. Every kind's brief in `src/aside-brief.ts` is the
floor, not a fallback — Claude answers an aside from it alone, and where a skill
would have done better it says so at the end of the aside with the command
above. The browser never learns what you have installed
(`docs/adr/0015-skill-availability-is-not-session-state.md`).

### From a clone

```sh
bun install          # one workspace: server + ui deps, installs git hooks
bun run build        # builds ui/dist once; the MCP server only serves it
bun run demo         # plays Claude against the server, opens the browser
```

See `CONTRIBUTING.md` for running your working copy from Claude Code and for
the release process.

### Step 0

Before the browser opens, Claude settles three things — asking only for what you
did not already say when you invoked it:

- **Mode** — `grill-me`, or `grill-with-docs` to also read this project's
  `CONTEXT.md` and `docs/adr/` and write new terms and decisions as they settle.
- **Question budget** — a maximum number of questions, no maximum by default. It
  counts questions inside rounds; asides and the last round are free. Spent in
  full, Claude names what it did not get to and what it is assuming.
- **Language** — English or French. It covers what Claude writes — questions,
  notes, asides — and not the browser's own words or this repo's documents.

### The last round

When the frontier empties, Claude posts the full shared understanding as a note
and asks one short question whose options are the four **destinations** — where
the plan goes next:

|                         |                                                              |
| ----------------------- | ------------------------------------------------------------ |
| **Just send to Claude** | Claude writes the plan into the terminal and stops.          |
| **`/implement`**        | …and ends with the line you type to build it.                |
| **`/to-spec`**          | …and ends with the line you type to publish it as one issue. |
| **`/to-tickets`**       | …and ends with the line you type to cut it into tickets.     |

Three of the four are `disable-model-invocation` skills, so the answer never
starts anything — it says what to set you up for, and all three read the
conversation they are typed in. A free-text answer to that question means "not
yet": the decision it names reopens and the grilling carries on. Nothing about a
destination reaches the Store or a snapshot; it is an ordinary answer to an
ordinary round, and the menu never varies with what you have installed.

### Offloading another skill's questions

Grilling is one kind of session. The other is an **offload**: type
`/bbq-offload` (`/bbq-mcp:bbq-offload`) and whatever skill Claude runs next —
`superpowers:brainstorming`, a wrapper around it, your own interview skill —
keeps its flow in the terminal while every question it would ask you arrives in
the browser, one at a time, as it comes up.

- The running skill owns the ending. There is no frontier, no last round and no
  destination; bbq only asks.
- A round sends itself on the answer that completes it: no **Send answers to
  Claude** press. Picking and confirming an option still take two presses.
- There is no Step 0. The language follows the conversation (`/bbq-offload fr`
  overrides it).
- Close the tab's session and Claude asks the remaining questions in the
  terminal; it never reopens one on its own.
- The skill's own browser companion, if it has one, is not offered: **Show me**
  answers visual questions.

The kind is set on `open_session` and changes the prose each tool result
carries back to Claude (`docs/adr/0021-offload-is-a-session-kind.md`).

## Design

**Claude never talks to the browser.** Claude talks to state (`src/state.ts`);
state and the browser talk over WebSocket (`src/hub.ts`). The MCP tools
(`src/mcp.ts`) only read/mutate state and `waitFor` changes. That seam is the
whole design.

```
Claude ──MCP stdio──▶ src/mcp.ts ──▶ Store (src/state.ts) ◀── WS ── src/hub.ts ◀── browser (ui/)
```

### Tools

| tool                                                   | blocks?                                                  | purpose                                                             |
| ------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------- |
| `open_session({ title, kind? })`                       | until a tab connects (≤ `waitForBrowserMs`, default 30s) | start a `grilling` (default) or `offload` session, open the browser |
| `ask_round({ sessionId, intro?, questions })`          | no                                                       | publish one round: a frontier, or an offloaded question             |
| `wait_for_answers({ sessionId, roundId, timeoutMs? })` | ≤ `timeoutMs`                                            | poll; returns `answered` / `aside_requested` / `pending` / `closed` |
| `post_aside({ sessionId, asideId, format, content })`  | no                                                       | deliver a Wait-what / Show-me / ELI5 result to the panel            |
| `post_note({ sessionId, markdown })`                   | no                                                       | chat bubble between rounds                                          |
| `close_session({ sessionId })`                         | no                                                       | mark the session finished                                           |

### Polling contract

No tool ever blocks past its timeout. `wait_for_answers` waits at most
`timeoutMs` (default 55s via `BBQ_WAIT_MS`, hard cap 280s: under Claude
Code's 5-minute MCP idle cutoff) and returns `pending` on timeout. Claude just
calls it again, so a round can sit open for an hour at the cost of one cheap
tool call per minute. Asides interrupt the wait immediately and are returned
before answers so the user is never left staring at a spinner.

### UI rules

- One question is active at a time; the first unanswered one on a new round.
- Question N unlocks once N-1 is answered. Any answer can be changed until the
  round is sent (click an answered question to reopen it).
- Answering advances to the next question. When all are answered, **Send
  answers to Claude** submits the round; the round then freezes. In an offload
  session the completing answer submits it and there is no send button.
- The active card shows three separated blocks: question, options
  (+ manual answer textarea), recommendation (+ _Go with recommendation_, and the
  three aside buttons).
- The right panel is per question, tabbed by aside kind, closable (Esc).
  `markdown` asides render as rich text; `html` asides render in a sandboxed
  frame (no scripts). Claude picks the format per aside — the kind does not fix
  it. A ```mermaid block in an aside is drawn: mermaid arrives through a lazy
  `import()`, renders to an SVG string and goes through the same frame, and a
  block that does not parse falls back to its source.

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
src/mcp.ts          MCP entry (stdio) + tools
src/state.ts        Store: sessions, rounds, answers, asides, notes, waitFor
src/round-rules.ts  pure round rules shared with the UI (canAnswer, isComplete, sendsOnAnswer)
src/tool-prose.ts   the next-step prose tool results carry, per session kind
src/protocol.ts     Zod validation of browser -> hub messages
src/hub.ts          Bun.serve: static ui/dist, WS relay, token auth
src/browser.ts      open the default browser without touching stdio
src/types.ts        shared types (imported by the UI as @shared/types)
ui/                 Vite 8 + React 19 (React Compiler) + Tailwind v4, builds to ui/dist
  src/router.tsx    TanStack Router: / and /s/$sessionId (typed search params)
  src/lib/          Query options, WebSocket -> cache feeder (Pacer backoff), mutations, derivations
  src/components/   Question card, round, aside panel, TanStack Form manual answer, markdown, diagrams
  src/components/ui shadcn components on Base UI (ours to edit)
scripts/demo.ts     fake Claude for manual testing
skills/             bbq (the grilling protocol), bbq-offload (another skill's questions), barbecue/churrasco alias stubs
.claude-plugin/     plugin + marketplace manifests; .mcp.json is the plugin's pinned server entry
test/               bun tests for state, protocol, hub and release manifests
```

## Tooling

- `bun run check` is the definition of done: `oxfmt --check`, type-aware `oxlint`, `tsc` for both packages, `bun test`, `vite build`.
- Lint and format are [ultracite](https://www.ultracite.ai) presets on top of oxlint + oxfmt (`oxlint.config.ts`, `oxfmt.config.ts`), with the same additions as a sibling internal repo. Zero suppressions.
- `lefthook` runs format + lint on staged files before each commit and `bun run check` before each push.
- Releases: tag `vX.Y.Z`, CI publishes `bbq-mcp` to npm with provenance (`CONTRIBUTING.md`, `docs/adr/0020-distribution-is-npm-wrapped-by-a-plugin.md`).
- `.claude/settings.json` runs `ultracite fix` after every file Claude writes. `CLAUDE.md` holds the rules an agent must know; `AGENTS.md` is the generated ultracite standard.
- UI state model: TanStack Query owns the session snapshot (fed by the WebSocket), TanStack Router owns the view state in the URL, there is no `useEffect` in `ui/src` (the import is banned by lint) and the React Compiler handles memoisation.

Env: `BBQ_WAIT_MS` default poll length, `BBQ_NO_OPEN=1` to not launch a browser.
