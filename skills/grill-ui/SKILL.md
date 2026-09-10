---
name: grill-ui
description: Run a grilling session in the browser instead of the terminal. Use when the user asks to grill with the UI, says "grill-ui", or when a grilling session will be long and the grill-ui MCP tools are available.
---

Run the `grilling` skill exactly as written (design tree, frontier, rounds, one recommendation per question), but the browser is the conversation surface, not the terminal.

## Protocol

1. `open_session({ title })` once. It opens the browser and returns `sessionId`. Tell the user in one line that the session is open in the browser.
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
- Asides answer the *question as asked*; never add options or change the recommendation inside an aside.
