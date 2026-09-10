---
status: accepted
---

# A game loop needs no effect: the pastime ticks from a module store

A lull offers a pastime, and a pastime is snake: something has to fire every ~110ms and stop when the board leaves the screen. That is the textbook `useEffect` — mount, `setInterval`, return `clearInterval` — and ADR 0004 bans it. That ADR also left a door open, "anything that genuinely needs an effect must live in a named hook under `ui/src/lib` with a written justification; today there are none", and a game loop is the most effect-shaped feature anyone has brought to this codebase. It did not need the door.

`ui/src/lib/pastime/store.ts` is a plain module holding the run, a `Set` of listeners and a `subscribePastime(listener)` that returns an unsubscribe, read from the board with `useSyncExternalStore` — the same shape as `ui/src/lib/theme.ts` and the same way `theme-toggle.tsx`, `diagram.tsx` and `html-frame.tsx` read that one. The part that removes the need for an effect is the teardown: **`useSyncExternalStore`'s unsubscribe _is_ the cleanup**. The interval opens on the first arrow key, and closes when the run ends or when the last listener leaves — and the last listener leaves exactly when the board unmounts, which is when the round opens and `SessionFooter` stops rendering the lull. Mount and unmount are handled without React running an effect, because the store never had to be told about mounting in the first place.

Two neighbouring choices fall out of the same reasoning and are recorded here rather than in their own files. The board is **DOM, not canvas**: a 20×14 grid drawing only its occupied cells is ten to twenty positioned divs at 9fps, and they take `bg-primary` straight from `styles.css`, where a canvas would have to read the resolved custom properties at runtime, subscribe to `lib/theme.ts` to repaint on a theme change (ADR 0013) and scale for `devicePixelRatio`. And the arrow keys come from a **window listener that stands down whenever anything is focused** — `document.activeElement` is not `<body>` — so a keypress starts the snake with no clicking, while tabbing or clicking into the timeline or the aside panel hands the arrows back to the `ScrollArea`, which a blanket `preventDefault` would have silently broken for the length of every lull.

## Consequences

- The count of justified effect hooks in `ui/src` stays zero, and the hardest case anyone tried is the evidence. A future proposal to add one has to beat a game loop.
- An interval in a module with no `useEffect` in sight reads as a missing effect. `pastime/store.ts` carries a header comment pointing here, the way `lib/theme.ts` points at ADR 0013.
- The pastime is browser-only and stays out of `src/`: no `Session` field, no `ClientMessage`, no shape in `src/protocol.ts`. Same seam argument as ADR 0001, ADR 0008 and ADR 0015 — a pastime is not state of the grilling. Its rules are still tested from `test/pastime.test.ts`, which imports `ui/src/lib/pastime/snake-rules.ts` across the packages: the root tsconfig has no DOM in its `lib`, so that import is also what keeps the rules pure.
- Because the board unmounts with the footer, a run ends when the round lands and nothing is remembered but the all-time best, in `localStorage` beside `grill-ui:theme`.
- `prefers-reduced-motion` does not hide the board: nothing moves until an arrow key is pressed and it stops when the run does. The preference is applied to the pulsing dot on the lull line, which animates unasked.
