---
status: accepted
---

# The browser always receives the whole session snapshot, never a delta

Every change to a session is broadcast to every connected tab as the complete `Session` object, and a rejected browser message is answered with an error frame followed by a fresh snapshot. We rejected incremental patches (per-answer, per-aside events) even though they are smaller, because whole snapshots make reload, reconnect, a second tab and an optimistic update that must snap back all the same operation: replace what you have. It also keeps the hub a dumb relay with no per-client bookkeeping beyond the socket itself. A grilling session is small (tens of questions, a handful of asides) so the bandwidth cost is irrelevant; the design would need revisiting only if sessions carried large payloads such as many big HTML asides.
