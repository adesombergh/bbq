- Sound when claude gets info back.

- Diagrams in asides (second half of the grilled design; ADR 0014 still to write)
  - lazy `import("mermaid")` inside a TanStack Query `queryFn`, keyed on source + resolved theme
  - render to an SVG string, show it in the existing `HtmlFrame`; asides only, via a
    separate markdown component beside `AsideBody` (plain `Md` stays diagram-free)
  - a diagram that does not parse falls back to the source in a code block
  - `ASIDE_BRIEFS` in `src/mcp.ts`: format becomes Claude's per-aside choice, not the kind's;
    the show-me brief keeps delivery only (post_aside, never a file) and may mention mermaid
- Step 0.3: ask what game will be played during waiting state. Options: snake, flappy, slot machine.
- Games on waiting state
- When frontier is empty and user confirmed shared understanding: user can choose:
  - Just send to claude
  - /implement
  - /to-spec
  - /to-tickets
- Export ???
  -> Artifact ?
  -> QUestionnaire ?
  -> PDF ?
- Edit session title?
