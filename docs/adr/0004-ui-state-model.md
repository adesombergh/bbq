---
status: accepted
---

# The UI has no effects: the session lives in the Query cache, the view lives in the URL

The browser mirrors one `Session` snapshot. We put that snapshot in TanStack Query (first load over HTTP, every WebSocket frame written into the cache from a module outside React) and every piece of view state (active question, aside panel, panel tab, dismissed aside) into typed URL search params with derived defaults. Nothing is stored twice and nothing is synchronised, so `useEffect`, `useMemo`, `useCallback` and `memo` are banned in `ui/src` and the React Compiler does the memoisation. The alternatives were a hand-rolled store with effects syncing local state (the original UI) or a reactive store without the URL; both needed effects to keep "current X" in step with new rounds and asides, which is exactly the class of bug this rules out.

## Consequences

- A refresh, the back button or a shared link restores the exact view.
- Adding view state means adding a search param and a derivation, not a `useState`.
- Anything that genuinely needs an effect must live in a named hook under `ui/src/lib` with a written justification; today there are none.
