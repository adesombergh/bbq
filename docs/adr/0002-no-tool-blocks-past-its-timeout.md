---
status: accepted
---

# Waiting is polling: no MCP tool blocks past its timeout

Claude Code kills an MCP call that stays silent for about five minutes, yet a person may take an hour to answer a round. Rather than stream progress or keep a connection alive, every waiting tool returns `pending` at its timeout (default 55 s, hard cap 280 s) and Claude simply calls it again. Asides interrupt the wait and are returned before answers so the person is never left staring at a spinner. This makes the tool protocol slightly chatty, but it keeps every call well inside the host's limits and needs no long-lived state in the MCP layer.
