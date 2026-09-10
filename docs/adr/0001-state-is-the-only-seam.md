---
status: accepted
---

# Claude and the browser never talk to each other; both talk to the Store

The MCP tools Claude calls only read and mutate an in-memory Store and wait for it to change. The browser only subscribes to that Store over a WebSocket and applies validated messages to it. Neither side knows the other exists. We chose this over a request/response bridge between the MCP layer and the browser because it lets a round sit open for an hour, survive browser reloads and multiple tabs, and be exercised without Claude at all (`scripts/demo.ts`, the tests). The price is that every feature is expressed as a state transition plus a `waitFor` predicate, never as a direct call.
