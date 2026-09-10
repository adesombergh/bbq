---
status: accepted
---

# Sessions live in the memory of the MCP process and die with it

The Store is an in-memory map; nothing is written to disk and a session is gone when Claude Code stops the server (stdin close, SIGINT, SIGTERM). This is deliberate: a grilling session only makes sense while the Claude conversation that drives it is alive, and that conversation owns the MCP process. Persisting sessions would invite a second class of state (stale sessions with no Claude behind them) that the browser would have to explain, and would require ids to be stable across restarts. The trade-off is that a server crash loses the open round; the mitigation is that Claude keeps the answers it has already received in its own context, and that the browser shows a reconnect state rather than pretending the session is alive.
