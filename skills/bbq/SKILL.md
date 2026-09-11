---
name: bbq
description: Run a grilling session in the browser instead of the terminal. Use when the user asks to grill with the UI, says "bbq", "barbecue" or "churrasco", or when a grilling session will be long and the bbq MCP tools are available.
---

Run the `grilling` skill exactly as written (design tree, frontier, rounds, one recommendation per question), but the browser is the conversation surface, not the terminal.

## Step 0 — settle the session before opening it

Three settings decide how the session runs. Take whatever the invocation already
gave you (`/bbq with docs, max 20, fr`) and ask for the rest in **one**
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
  question, explained again) and so is the last round; a decision you genuinely
  reopen counts again. On reaching the cap, `post_note` every decision you did
  not get to with the answer you are assuming for each, then go straight to the
  last round.
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
5. When the frontier is empty, run the last round — below.

## The last round

The last round confirms the shared understanding **and** chooses where the plan
goes. One press does both. It is an ordinary round in every respect: nothing
about a destination reaches the Store, the protocol or a snapshot.

1. `post_note` the **full shared understanding**. This is the long one — every
   settled decision, with the reasoning that is not obvious from the outcome.
2. `ask_round` with exactly **one** question. Keep the body short: the plan is
   in the note directly above it. Its four options are always these four, in
   this order, never more and never fewer:
   - **Just send to Claude**
   - **`/implement`**
   - **`/to-spec`**
   - **`/to-tickets`**
3. `wait_for_answers`. A **manual answer** means "not yet": it names what is
   wrong, so reopen that decision and carry on from step 2 of the protocol.
4. `close_session`, then act on the destination.

### Recommending a destination

Every question carries a recommendation, this one included. It comes from the
size of the plan you just built:

| The plan                                | Recommend                                     |
| --------------------------------------- | --------------------------------------------- |
| Fits one session                        | **`/implement`**                              |
| Spans several sessions                  | **`/to-spec`**, then `/to-tickets` per ticket |
| Is something the user wants to sit with | **Just send to Claude**                       |

Say in one line which rule you applied, so the user can tell you it got the size
wrong.

### Acting on a destination

You **cannot invoke** `/implement`, `/to-spec` or `/to-tickets`. All three ship
`disable-model-invocation: true`, so an answer never starts anything — it says
what to set the user up for. All three read the conversation they are typed in,
which is why printing the plan into the terminal is the whole handover: the
thread becomes the record. This session's record is not one — it dies with the
server process (`docs/adr/0009-sessions-live-in-process-memory.md`).

- **Just send to Claude** → write the shared understanding into the terminal in
  full, and **stop**. Do not start building. The ball is the user's.
- **`/implement`**, **`/to-spec`**, **`/to-tickets`** → write the shared
  understanding into the terminal in full, then end with the one line the user
  is meant to type.

The menu never varies with what is installed
(`docs/adr/0015-skill-availability-is-not-session-state.md`). If the chosen
destination needs a tracker or a skill the user has not got, say so in the
terminal, after the fact — never by dropping the option.

## Rules

- Facts are yours to find (sub-agents), decisions are the user's. Never put a lookup in a question.
- Never block waiting for the user in the terminal; `wait_for_answers` is the only wait and it is safe to loop.
- Keep terminal output to one line per round at most, until the last round. The user is reading the browser.
- Asides answer the _question as asked_; never add options or change the recommendation inside an aside.
- Pick the aside `format` that matches what you produced — the kind the user pressed does not fix it. Markdown renders as rich text; HTML renders in the sandboxed frame, so it must be a self-contained fragment with inline CSS, no scripts and no external resources. Never write a file or open one.
