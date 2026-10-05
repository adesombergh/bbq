# Changelog

All notable changes to this project are documented here. The format is
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `bbq-offload` skill and an **offload** session kind: whatever skill Claude is
  running (`superpowers:brainstorming`, a wrapper around it, a custom interview)
  keeps its flow in the terminal while its questions are asked in the browser,
  one at a time. The running skill owns the ending — no frontier, no last round,
  no destinations. `open_session` takes an optional `kind`
  (`grilling` by default), the next-step prose in tool results follows it, and
  an offload round sends itself on the answer that completes it (ADR 0021).

### Changed

- `grill-with-docs` reads and writes the project's `GLOSSARY.md` instead of
  `CONTEXT.md`; the **Wait what** brief points at it too.

- `wait_for_answers` polls every 240 s instead of 55 s, and returns a new
  `disconnected` outcome the moment the last browser tab goes away, so the
  longer wait costs no responsiveness. A poll that finds nothing is two lines
  while a tab is connected, and spends words on the URL only when there is no
  browser to answer in (ADR 0002).
- Tool results teach the protocol once and recall it in one line afterwards:
  the full next step on the first answered round, a single line on the ones
  after it. An aside request names the options of its question instead of
  re-describing them. Tool descriptions trimmed.
- All tool-result prose moved from `src/mcp.ts` to `src/tool-prose.ts`, which
  makes it testable; `src/mcp.ts` is wiring only.

## [0.1.0] - 2026-09-11

First public release.

### Added

- MCP server (`bbq-mcp`) with six tools: `open_session`, `ask_round`,
  `wait_for_answers`, `post_aside`, `post_note`, `close_session`.
- Prebuilt browser UI: rounds of questions, two-press answers, manual answers,
  a per-question aside panel (**Wait what**, **Show me**, **ELI5**) with
  markdown, sandboxed HTML and diagrams.
- `bbq` skill that runs the `grilling` skill in the browser, with `barbecue`
  and `churrasco` alias stubs.
- Claude Code plugin and single-plugin marketplace hosted in this repository.

[Unreleased]: https://github.com/adesombergh/bbq/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/adesombergh/bbq/releases/tag/v0.1.0
