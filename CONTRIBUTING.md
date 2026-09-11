# Contributing

bbq is small and opinionated. Before changing behaviour, read `README.md` for
the design, `CONTEXT.md` for the vocabulary, and `docs/adr/` for the decisions
that are deliberate. `CLAUDE.md` is the checklist an agent follows to edit this
repo; it applies to people too.

## Setup

```sh
bun install      # server + ui deps, installs the git hooks
bun run build    # builds ui/dist once; the server only serves it
bun run demo     # plays Claude against the real server, opens the browser
```

Requires [Bun](https://bun.sh) 1.4 or newer. Node is not supported: the hub is
built on `Bun.serve`.

The repository's own `.mcp.json` is the plugin's server declaration, so it
runs the _published_ `bbq-mcp`, not your working copy. To grill with your
working copy from Claude Code, register it once at local scope (stored outside
the repo):

```sh
claude mcp add --scope local bbq-dev -- bun run /path/to/bbq/src/mcp.ts
```

and turn the published one off for this checkout so the two servers' identical
tool names do not compete, in `.claude/settings.local.json` (gitignored):

```json
{ "disabledMcpjsonServers": ["bbq-mcp"] }
```

## Definition of done

```sh
bun run check
```

Formats, lints (type-aware, zero suppressions), typechecks both packages, runs
the tests and builds the UI. The pre-commit hook runs format and lint on staged
files, the pre-push hook runs the whole thing. CI runs it again on every pull
request.

- Add a test in `test/` for every new Store rule or protocol shape.
- Use the terms in `CONTEXT.md`; when a new term settles, add it there.
- When a decision is hard to reverse, surprising, or a real trade-off, write a
  `docs/adr/NNNN-slug.md`. Do not "fix" an existing ADR without a new one.
- Add a line under _Unreleased_ in `CHANGELOG.md`.

## Releasing

The npm package `bbq-mcp` and the Claude Code plugin are one release with one
version (`docs/adr/0020-distribution-is-npm-wrapped-by-a-plugin.md`).

1. Move the _Unreleased_ entries in `CHANGELOG.md` under the new version.
2. Bump the version in `package.json`, `.claude-plugin/plugin.json`,
   `.claude-plugin/marketplace.json` and the pinned `bbq-mcp@…` in `.mcp.json`.
   `bun test` fails if they disagree.
3. Commit, tag `vX.Y.Z`, push the commit and the tag.

`.github/workflows/release.yml` then runs `bun run check` on a clean machine
(so `ui/dist` is never stale) and publishes with `npm publish --provenance`
through npm trusted publishing. No token is stored anywhere.

One-time setup, by the package owner on npmjs.com: on the `bbq-mcp` package
page, _Settings → Trusted publisher_, choose GitHub Actions, repository
`adesombergh/bbq`, workflow `release.yml`. The first version has to be
published by hand (`bun run check && npm publish --access public`) because a
trusted publisher can only be attached to a package that exists.
