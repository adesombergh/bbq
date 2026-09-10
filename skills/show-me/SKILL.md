---
name: show-me
description: "Draw it: turn the last question / decision into a visual (diagram, comparison, flow) instead of more words."
disable-model-invocation: true
---

The last thing you said did not build a picture in my head. Show me instead of telling me.

Produce one self-contained visual about the decision at hand: a comparison grid, a flow, an architecture sketch, a timeline, or a before/after. Inline SVG or simple styled HTML, inline CSS only, no scripts, no external resources, readable on a dark background. Mark the recommended option visually. Big shapes, few words; every label under ~6 words. Do not add options or change the recommendation.

If you are in a grill-ui session, deliver it with `post_aside` (format `html`). Otherwise write it to a file and open it.
