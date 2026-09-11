---
status: accepted
---

# The theme is a device preference, so it lives in localStorage, not the URL

Every other piece of view state is a typed URL search param (ADR 0004), but the theme is not view state of _this session_: it belongs to the person's screen, it should survive from one grilling to the next, and it has no business riding along in a link handed to someone else. So `ui/src/lib/theme.ts` keeps it in `localStorage` under `bbq:theme`, outside React, and the button reads it through `useSyncExternalStore` — no effect, no second copy. A `?theme=` param was the alternative: it obeys the rule literally, but resets on any link that omits it and leaks a personal setting into a shared URL.

The stored value is one of `system` (the default), `light` or `dark`. `system` is resolved in JavaScript, never in CSS: the module writes a concrete `data-theme="dark" | "light"` on `<html>`, and a `matchMedia` listener re-resolves when the OS flips while the preference is `system`. `styles.css` therefore never mentions `prefers-color-scheme` — it has one `@custom-variant dark` on the attribute and two flat palettes. An inline script in `index.html` repeats that first resolution before the bundle loads, so the page never paints in the wrong theme; that duplication is deliberate and is the price of no flash.

## Consequences

- The URL rule in `CLAUDE.md` stands for session view state. This is its one exception, and a new one needs its own ADR.
- The stored preference applies to every screen, but only `SessionHeader` can change it: `NoSession`, `Connecting` and `SessionError` carry no control.
- Changing the storage key or the attribute name means changing two places: `lib/theme.ts` and the inline script in `index.html`.
