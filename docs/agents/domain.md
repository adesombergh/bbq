# Domain Docs

How the engineering skills should consume this repo's domain documentation when
exploring the codebase. bbq is **single-context**: one glossary and one ADR
directory, both at the repo root.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the vocabulary. Use those terms in code,
  docs and questions.
- **`docs/adr/`** — read the ADRs that touch the area you are about to work in.
  They record the decisions that are deliberate and should not be "fixed".

If any of these files don't exist, **proceed silently**. Don't flag their
absence; don't suggest creating them upfront. The `/domain-modeling` skill
(reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates
them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-state-is-the-only-seam.md
│   └── …
├── src/          server (Bun, MCP + hub)
└── ui/           browser UI (Vite + React)
```

There is no `CONTEXT-MAP.md`: `src/` and `ui/` are two halves of one product
that share `src/types.ts` and `src/round-rules.ts`, not two bounded contexts.
Splitting them would be a new ADR, not a directory move.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor
proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`.
Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either
you're inventing language the project doesn't use (reconsider) or there's a
real gap (note it for `/domain-modeling`, and settle it in `CONTEXT.md`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than
silently overriding:

> _Contradicts ADR-0011 (tool results are prose that carries the next step) —
> but worth reopening because…_

New decisions that pass the ADR test (hard to reverse, surprising, a real
trade-off) get their own `docs/adr/NNNN-slug.md`.
