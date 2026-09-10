---
status: accepted
---

# The MCP server serves a prebuilt UI and never spawns build tooling

`src/mcp.ts` must start instantly and its stdout is the MCP JSON-RPC channel. Running Vite from the server would delay startup and risk polluting stdout, so the server only serves whatever is in `ui/dist` (with a placeholder page when it is missing) and every log goes to stderr. `ui/dist` is gitignored; `bun run build` is a deliberate, separate step. A future "dev mode with HMR" must run Vite as its own process and proxy to the hub, never from inside the server.
