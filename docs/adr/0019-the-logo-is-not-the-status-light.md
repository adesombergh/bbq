---
status: accepted
---

# 🔥🍖 never touches the favicon of an open session

The mark is 🔥🍖. It is the static favicon in `ui/index.html`, it is the face of the project in the README and the skill, and it is nowhere near `ui/src/lib/tab-status.ts`. The moment a session loads, the favicon becomes ❓, 🔥 or ✅ and stays a status light for the rest of the session.

Putting the logo there instead is the obvious improvement, and it costs the one thing that file exists to buy. A grilling runs for an hour with the tab pinned, and a pinned tab is 16 pixels of favicon with no title at all. At that size the favicon answers exactly one question — whose turn is it — and it answers it from across the room. ❓ and ✅ and 🔥 are legible as silhouettes because each is one glyph with a distinct outline. 🔥🍖 in the same SVG is two glyphs sharing a 100×100 box at `font-size: 90`: each renders at roughly half size, or the pair overflows. It is a smudge at 16 px, and a smudge that means "bbq" is worth less than a tick that means "done".

Replacing only the `thinking` state with 🔥🍖 was the tempting middle. It fails twice: one state twice as wide as the other two breaks the silhouette comparison that makes the light readable, and it teaches the logo to mean "Claude is busy" rather than "this is bbq".

The header takes lucide `Flame` + `Ham` rather than the emoji pair, because the rest of the chrome is lucide and a colour emoji ignores `text-primary` and renders differently on every machine. So the header mark and the favicon are cousins, not twins — a deliberate, known gap, taken in exchange for a header that obeys the theme tokens.

## Consequences

- `FAVICONS` in `tab-status.ts` stays a three-entry `Record<TabState, string>` of single glyphs. Two glyphs are fine in `index.html`, where nothing depends on a 16 px silhouette and the pair can be shrunk to `font-size: 48` to fit the box; they cannot go in `FAVICONS`.
- The brand is visible before a session loads and in the header throughout, which is where a person actually looks for it.
- Anyone proposing 🔥🍖 as the session favicon is proposing to trade the pinned-tab status light for it, and should say so.
