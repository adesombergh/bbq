---
name: bbq-offload
description: Offload the questions of whatever skill is running (brainstorming, a custom skill) to the bbq browser UI, one question at a time, while that skill's own flow stays in the terminal. Use when the user types /bbq-offload, says "offload the questions to bbq" or "ask me in the browser", and the bbq MCP tools are available.
---

This is not a grilling. Keep running the skill you are already running (or are
about to run) **exactly as written** — its classification, its steps, its gates,
its ending. The only thing that changes is where its questions are asked: in the
browser, through the bbq tools, instead of in the terminal. bbq is the place
questions are asked, nothing more; the running skill owns what happens after
the last one (`docs/adr/0021-offload-is-a-session-kind.md`).

## No Step 0

There is no mode and no question budget: the running skill decides how many
questions it asks and what it does with documents. The **session language** is
the conversation's language; an argument (`/bbq-offload fr`) overrides it. It
covers questions, options, recommendations, notes and asides, and nothing else.

## Protocol

1. **Open on the first question, not before.** When the running skill first
   needs to ask the user something, call
   `open_session({ title, shortTitle, kind: "offload" })`. `title` names what the
   skill is working on; `shortTitle` is two to four words for the browser tab.
   Tell the user in one line that the questions are now in the browser.
2. **Every question goes to the browser.** A question the skill would print, an
   `AskUserQuestion`, an approval gate — each becomes `ask_round({ sessionId,
questions })`. One question per round is the normal case; questions the skill
   would ask together in one message go in one round. Each question object:
   - `title`: a short bold title. `body`: the question, markdown, with the
     context the user needs to answer it.
   - `options`: `{ label, description? }` for a closed question; omit for an
     open one.
   - `recommendation`: **always present** — your best guess, even for an open
     question. If it is one of the options, also set `recommendedOptionId`.
3. **Loop on `wait_for_answers({ sessionId, roundId })`.**
   - `pending` → call it again. Say nothing in the terminal.
   - `aside_requested` → do what the result says, `post_aside`, wait again.
   - `answered` → hand the answers back to the running skill and continue it.
     The round sent itself when its last question was answered; there is no
     send press to wait for.
   - `closed` → the user ended it. Say so in one line and ask any remaining
     questions in the terminal. Never open a new session on your own.
4. **Close when there is nothing left to ask.** When the running skill reaches a
   step with no more questions (the spec is approved and implementation starts,
   the handoff is printed), call `close_session`. The user can also say stop.

## Mapping a skill's gates

- **Something to approve** (a design section, a written spec, a plan): the
  question body holds the section itself, the options are **Approve** and
  **Revise**, and the recommendation says which and why. A manual answer names
  the revision.
- **Approaches to choose from**: one question, one option per approach with its
  trade-off in `description`, the recommended one in `recommendedOptionId`.
- **A classification the skill announces** (for `brainstorming`: spike, bounded
  or architectural) is said in the terminal, not asked, unless the skill asks.

## Rules

- Progress, results and the work itself stay in the terminal. Only questions go
  to the browser; never print a question in both places.
- Before a long silent step between two questions (writing a spec, exploring
  the codebase), `post_note` one line saying what you are doing.
- Do not offer a skill's own browser companion (`brainstorming`'s visual
  companion). A question that needs a picture says so in its body; the user
  presses **Show me**.
- Asides answer the _question as asked_; never add options or change the
  recommendation inside an aside. Pick the aside `format` that matches what you
  produced. Never write a file or open one for an aside.
- The skill you are running is still in charge: its hard gates, its terminal
  state and the next skill it invokes are unchanged by being offloaded.
