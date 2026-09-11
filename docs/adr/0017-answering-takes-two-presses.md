---
status: accepted
---

# Answering a question takes two presses, and a pick never reaches the Store

Clicking an option no longer answers a question: it **picks** it, and a confirm button inside the picked row is what turns the pick into an **answer**. Only options are gated — **Go with recommendation** and the manual answer form still answer in one press, because both are deliberate acts with their own label and neither is something a reading finger lands on. A pick is browser-only view state — it lives in `?pick=` on the active question and nowhere else, so the Store never sees it, `canAnswer` keeps the next question locked, the answer footer stays empty and **Send answers to Claude** stays disabled until the person confirms. Leaving the question forgets the pick; one exists at a time. Reopening an already-answered question never retracts anything: the recorded answer stands, and a new pick replaces it only on confirm, so a curious click on a finished round cannot relock its tail (ADR 0007 would relock it whether we liked it or not).

We did this because the round is read while it is answered. A click meant as "this looks like the one" was collapsing the card and advancing the active question before the person had finished reading, and the answer was already in the Store by then. Recording the answer on click and using the button only to advance would have been a smaller diff, but then "Confirm" would name nothing: the choice would already have been made, sent and unlocking. The cost is a press on every question, forever, paid by everyone to prevent a misclick.

We tried gating the recommendation too and took it out: a second button beside a button that already says "Go with recommendation" is ceremony around the path most people take, and it makes the card's busiest corner busier. The asymmetry between the three ways to answer is the price, and it is the cheaper one.

Two consequences a later reader will be tempted to undo:

- **The confirm is deliberately inert while it fades in.** It appears inside the row you just clicked, near the pointer that clicked it, so a double-click would sail straight through the gate we just built. `.pick-confirm` in `styles.css` fades it over 250ms and holds `pointer-events: none` for that fade with a `step-end` animation — no state, no timer, no effect. This is the mechanism, not a rough edge. Under `prefers-reduced-motion: reduce` there is no fade and the button is armed at once; the keyboard has no equivalent hazard, because reaching the confirm means tabbing to it.
- **An option row is a `div` with `role="button"`.** A button cannot contain a button, so the row that wraps the confirm cannot be one. We kept the semantics the old `<button aria-pressed>` claimed and hand-rolled Enter and Space rather than importing a Base UI Radio Group: the radio group is the truthful markup and would have given arrow-key movement for free, but it also wants a roving `tabIndex`, which is focus management, which is the effect ADR 0004 does not want. The accepted price is one tab stop per option row and a screen reader hearing N toggle buttons rather than one choice of N.
