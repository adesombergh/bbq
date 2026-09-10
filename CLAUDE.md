@AGENTS.md

# grill-ui

MCP server (Bun, `src/`) plus a prebuilt browser UI (Vite + React, `ui/`) for long grilling sessions. Read `README.md` for the design; this file is the part an agent must know before editing.

## Definition of done

Run this before you report a task finished. It formats, lints (type-aware), typechecks both packages, runs the tests and builds the UI:

```sh
bun run check
```

Individual steps when iterating: `bun run fix` (format + auto-fix), `bun run lint`, `bun run typecheck`, `bun test`, `bun run build`. The `PostToolUse` hook in `.claude/settings.json` already runs `ultracite fix` on every file you write, so formatting is never the thing to fix by hand.

Lint runs with zero suppressions. Do not add an `oxlint-suppressions.json`, do not loosen a rule in `oxlint.config.ts` to make a finding go away. A per-line `// oxlint-disable-next-line <rule> -- <why>` is acceptable only with the reason written out; unused disables are errors.

## The seam

Claude talks to state (`src/state.ts`); state and the browser talk over WebSocket (`src/hub.ts`). MCP tools (`src/mcp.ts`) only read/mutate the Store and `waitFor` changes. The browser sends validated `ClientMessage`s (`src/protocol.ts`) and receives whole `Session` snapshots. Pure rules shared by both sides live in `src/round-rules.ts`; shared types in `src/types.ts` (the UI imports both as `@shared/*`).

Hard constraints from the README still hold: stdout belongs to MCP (log with `console.error`), the server never spawns Vite, `ui/dist` is prebuilt and gitignored, every `wait_*` tool returns before its timeout.

## UI rules the linter cannot fully express

- **No `useEffect`, `useLayoutEffect`, `useMemo`, `useCallback`, `memo`.** The import is banned in `ui/src`. Derive state from the session snapshot and the URL (`ui/src/lib/derive.ts`), let the React Compiler memoise, use ref callbacks for DOM work (see the scroll-to-newest ref in `routes/session-page.tsx`), and remount with `key` instead of syncing form state.
- **TanStack Query is the source of truth for the session.** `lib/session-query.ts` loads `/api/session/:id`; `lib/session-socket.ts` writes every WebSocket frame into that cache and lives outside React (started from the route loader). Browser → hub messages go through `useSendMessage` in `lib/session-mutations.ts`, which patches the cache optimistically and awaits the hub's acknowledgment.
- **UI state lives in the URL.** `?q=` (active question), `?panel=` (aside panel question), `?tab=` (aside kind) and `?dismissed=` are validated by the Zod schema in `lib/search.ts`; defaults are derived, never stored. Use `route.useNavigate()` with `search: (prev) => ({ ...prev, ...patch })`.
- **Forms are TanStack Form** (`components/manual-answer.tsx`). Timing (reconnect backoff) is TanStack Pacer. Markdown is `@tanstack/markdown`, imported only in `components/md.tsx`; keep `allowHtml` off, HTML asides render in the sandboxed `html-frame.tsx`.
- **shadcn on Base UI.** Components live in `ui/src/components/ui/` and are ours to edit. Add new ones with `bunx shadcn@latest add <name>` from `ui/`, then fix them to the house rules (arrow components, no `React.*` namespace, no manual memo, `cn` from `@/lib/utils`). Primitives come from `@base-ui/react/*`, icons from `lucide-react`.
- **Theme tokens** are the shadcn CSS variables in `ui/src/styles.css`, dark by default with a light palette under `prefers-color-scheme: light`. Use `bg-card`, `text-muted-foreground`, `text-primary`, plus the two extras `ok` and `info`. Do not reintroduce the old `bg-panel`/`text-ink` names.
- **Components are arrow functions, files are kebab-case, object keys are sorted.** The linter enforces all three; write them that way from the start.
- **Devtools are dev-only**: `ui/src/devtools.tsx` is loaded lazily behind `import.meta.env.DEV` and must stay out of `main.tsx`'s static imports.

## Server rules

- Validate anything from the browser with Zod in `src/protocol.ts` before it reaches the Store.
- Throw `StateError` (`src/state-error.ts`) for invalid transitions; `guard()` in `src/mcp.ts` turns it into an `isError` tool result.
- Add a test in `test/` for every new Store rule or protocol shape. Tests use `bun:test`.
- `scripts/demo.ts` plays Claude against the real server; run `bun run demo` to exercise the UI by hand.
