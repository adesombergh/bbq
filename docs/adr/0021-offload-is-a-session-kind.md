---
status: accepted
---

# Offload is a session kind, and destinations belong to grilling

bbq started as one thing: the grilling skill, played in the browser. People also run other interview-shaped skills — `superpowers:brainstorming`, repo-local wrappers around it, custom skills — and want the same page for their questions. Those skills have their own flow and their own required ending: brainstorming must end in `writing-plans`, a wrapper ends in its own handoff. They cannot be edited to know about bbq, and bbq cannot learn each of them.

So bbq gains a second **session kind**, **offload**, next to **grilling**. In an offload session the running skill keeps its flow in the terminal and every question it would ask goes to the browser as it comes up, usually one per round. bbq owns no ending: no frontier, no last round, no destinations. The protocol lives in a sibling skill, `skills/bbq-offload`, which Claude can invoke, rather than in a branch of `skills/bbq`, so the grilling protocol stays exactly as it was and each protocol lives in one file.

The kind is **state of the session** — `Session.kind`, set by `open_session({ kind })`, default `grilling` — not a note in a skill file. That looks heavier than it needs to be, since a one-question round already does "ask, wait, get the answer" with the six existing tools. It is the cheapest honest option because of ADR 0011: tool results carry the next step as prose, and grilling's next step ("recompute the frontier… run the last round… four destinations") would be read after every offloaded answer, pulling Claude into grilling's ending in the middle of someone else's skill. A skill that says "ignore what the tool tells you" contradicts the tool on every call. Separate `ask_question` / `wait_for_answer` tools were the other way out; they would describe the same Store operations twice. So the prose branches on the kind (`src/tool-prose.ts`), and the same six tools serve both.

The kind reaches the browser for one rule: **an offload round sends itself** on the answer that completes it (`sendsOnAnswer` in `src/round-rules.ts`, applied by the Store and mirrored by the optimistic cache). Three presses per one-question round was pure friction. The pick-and-confirm gate of ADR 0017 is untouched; only the **Send answers to Claude** press goes. Nothing else on the page changes.

## Consequences

- `CONTEXT.md`'s **destination** is a grilling term. An offload session never offers one; the running skill decides what follows.
- A `closed` outcome in an offload session tells Claude to fall back to the terminal and never reopen a session by itself — closing the tab is the clearest way to say "stop offloading".
- A recommendation is still required on every question in both kinds; no schema change was made to allow questions without one.
- bbq names no particular skill it offloads for. A wrapper that wants bbq automatically adds its own pointer to `bbq-offload`, in its own repo.
