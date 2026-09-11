# Security

bbq runs a local HTTP and WebSocket server for the duration of an MCP session.
It binds `127.0.0.1` on a random port and every request needs a per-process
token (`docs/adr/0010-loopback-with-per-process-token.md`). HTML asides render
in a sandboxed frame with no scripts
(`docs/adr/0006-html-asides-only-in-a-sandboxed-frame.md`).

## Reporting

Please do not open a public issue for a vulnerability. Use
[GitHub's private vulnerability reporting](https://github.com/adesombergh/bbq/security/advisories/new).
You should hear back within a week. Fixes ship as a patch release of
`bbq-mcp`, credited to you unless you prefer otherwise.

## Supported versions

Only the latest published version of `bbq-mcp` receives fixes.
