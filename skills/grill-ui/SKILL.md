---
name: grill-ui
description: Run a grilling session in the browser instead of the terminal. Use when the user asks to grill with the UI, says "grill-ui", or when a grilling session will be long and the grill-ui MCP tools are available.
---

Run the `grilling` skill exactly as written (design tree, frontier, rounds, one recommendation per question), but the browser is the conversation surface, not the terminal.

## Step 0 — settle the session before opening it

Three settings decide how the session runs. Take whatever the invocation already
gave you (`/grill-ui with docs, max 20, fr`) and ask for the rest in **one**
`AskUserQuestion` in the terminal, before `open_session`. Skip the question
entirely when the args answered it. None of the three reaches the server: they
live here, in this file, and in your head for the length of the session.

- **Mode** — `grill-me` or `grill-with-docs` (default `grill-me`). With-docs
  means both halves: read `CONTEXT.md`, `docs/adr/` and `README.md` so the
  questions use the project's ubiquitous language and never re-litigate a
  settled ADR, **and** run the `domain-modeling` skill throughout — challenge
  terms, sharpen fuzzy language, and write `CONTEXT.md` entries the moment a
  term settles rather than batching them to the end. The glossary may lead the
  code: a word the session agrees on belongs in `CONTEXT.md` even when nothing
  implements it yet. Offer an ADR only when the three-part test passes.
- **Question budget** — a maximum number of questions, default **no maximum**.
  It counts questions **inside rounds** only. Asides are free (they are the same
  question, explained again) and so is the final confirmation round; a decision
  you genuinely reopen counts again. On reaching the cap, `post_note` every
  decision you did not get to with the answer you are assuming for each, then go
  straight to the confirmation round.
- **Session language** — `english` or `french`, default `english`. Content only:
  questions, options, recommendations, notes and asides. The UI chrome,
  `CONTEXT.md`, ADRs, code and commit messages stay English. **The session
  language overrides any brief**, including the ones the tool results carry — an
  aside brief that prescribes Simplified Technical English is advice for the
  English case and does not apply to a French session.

## Protocol

1. `open_session({ title, shortTitle })` once. It opens the browser and returns `sessionId`. `title` is the descriptive one shown in the header; `shortTitle` is two to four words for the browser tab. Tell the user in one line that the session is open in the browser.
2. For each round, call `ask_round({ sessionId, intro?, questions })` instead of printing `❓ Q1 …`. One question object per frontier question:
   - `title`: the bold title. `body`: the full question, markdown, as many paragraphs as needed.
   - `options`: list `{ label, description? }` for closed questions; omit for open questions.
   - `recommendation`: your `➡️` line. If it is one of the options, also set `recommendedOptionId` (`a`, `b`, … by default).
3. Loop on `wait_for_answers({ sessionId, roundId })`:
   - `pending` → call it again. Say nothing in the terminal.
   - `aside_requested` → the user pressed **Wait what**, **Show me** or **ELI5** on a question. Do what the result says (invoke the named skill about that question, or follow the inline brief), then `post_aside({ sessionId, asideId, format, content })`, then wait again.
   - `answered` → the user's answers. Recompute the frontier and go to step 2.
4. Between rounds you may `post_note({ sessionId, markdown })` to say what got settled or that you are looking something up.
5. When the frontier is empty: `post_note` the shared understanding, ask a final one-question round to confirm it, then `close_session`.

## Rules

- Facts are yours to find (sub-agents), decisions are the user's. Never put a lookup in a question.
- Never block waiting for the user in the terminal; `wait_for_answers` is the only wait and it is safe to loop.
- Keep terminal output to one line per round at most. The user is reading the browser.
- Asides answer the _question as asked_; never add options or change the recommendation inside an aside.
- Pick the aside `format` that matches what you produced — the kind the user pressed does not fix it. Markdown renders as rich text; HTML renders in the sandboxed frame, so it must be a self-contained fragment with inline CSS, no scripts and no external resources. Never write a file or open one.
