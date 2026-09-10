---
status: accepted
---

# A mermaid diagram in an aside is rendered to a string and shown in the sandboxed frame

`show-me` is an external, markdown-first skill, so a Show me now arrives as pseudocode, a call tree, a diff or a ```mermaid block rather than as HTML. Mermaid is rendered rather than banned, but through the seam that already exists: `mermaid.render()` returns an SVG string, and that string is handed to `html-frame.tsx`, so nothing Claude authored ever becomes live DOM in the app document and ADR-0006's boundary is untouched.

Four consequences are deliberate. The library is behind a dynamic `import()` inside a TanStack Query `queryFn` — it unpacks to ~124 MB with 23 dependencies (d3, cytoscape, elkjs, katex), so the main bundle must not grow and the chunks must be fetched only when a diagram actually appears. The resolved theme is part of the query key, because the SVG is produced once and the frame cannot recolour it afterwards; flipping the switcher renders the other variant once and then serves both from cache. Diagrams are restricted to asides _structurally_, by giving the panel its own markdown entry point (`AsideMd`) rather than a flag on `Md`, so a round can never contain one. And a diagram that does not parse falls back to the source in a code block: the failure is the browser's, not Claude's, and degrading to what the app did before mermaid existed is the smallest surprise available.

The alternative — rendering mermaid into the app document for real fonts and selectable text — buys polish at the price of a second place where Claude's output becomes DOM. That trade is not worth making for a picture.
