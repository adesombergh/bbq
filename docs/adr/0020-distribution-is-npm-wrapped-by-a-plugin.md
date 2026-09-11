---
status: accepted
---

# Distribution is an npm package wrapped by a Claude Code plugin

bbq ships two ways and they are one release. The npm package `bbq-mcp` holds
the server (`src/`), the built UI (`ui/dist`) and the skills; it is a complete
server, runnable with `bunx bbq-mcp`. The Claude Code plugin in
`.claude-plugin/` holds no code: its MCP entry runs `bunx bbq-mcp@<version>`,
pinned to the plugin's own version, and its skills are the same `skills/`
directory. The repository is also a single-plugin marketplace, so the install
is `/plugin marketplace add adesombergh/bbq` then `/plugin install bbq-mcp`.

## Why the built UI lives in the tarball

`ui/dist` is build output and stays out of git (ADR 0003). A plugin installs
from git, so a plugin alone would have to either commit `ui/dist` or build it
on first run, and the server never spawns a build tool. The npm tarball is the
one artefact that can carry a prebuilt UI without committing it, and
`npm publish` from CI guarantees it is built from the tagged commit.

## Why the plugin pins the server version

The skill text and the tool results are one contract (ADR 0011): a skill that
names a tool argument the server does not know yet, or the reverse, fails in
ways no test catches. Pinning means a plugin version always runs the server it
was written against. The cost is that plugin users get server fixes only
through a plugin update. `test/release-manifests.test.ts` fails when the
versions drift.

## Why the name is `bbq-mcp`

`bbq` is taken on npm by an unrelated package. The plugin, the package and the
bin share the name so a person types one word everywhere. The GitHub repository
keeps the short name.

## Why Bun stays required

The hub is `Bun.serve`, the file server is `Bun.file`, the browser opener is
`Bun.spawn`. A Node port would rewrite the hub on `node:http` + `ws` and add a
bundle step, for reach nobody has asked for. `bunx` is one install away for
anyone who runs Claude Code.

## Consequences

- One version string in four places (`package.json`, `plugin.json`,
  `marketplace.json`, the pinned `bunx` argument); the release checklist in
  `CONTRIBUTING.md` bumps them together and a test checks they agree.
- `package.json` `files` is the packaging contract. Anything the server reads
  at runtime must be listed there.
- A plugin's MCP servers come from the `.mcp.json` at its root, and the plugin
  root is the repository root, so the repository's `.mcp.json` is the pinned
  `bunx bbq-mcp@<version>` entry, not a pointer at `src/mcp.ts`. Developing
  against the working copy means registering it at local scope
  (`CONTRIBUTING.md`).
- Plugin skills are namespaced by Claude Code: `/bbq-mcp:bbq`, `/bbq-mcp:barbecue`,
  `/bbq-mcp:churrasco`. The alias stubs of ADR 0018 name both spellings so the
  hop works from either install.
- The server reports `package.json`'s name and version over MCP, so the version
  is copied nowhere in `src/`.
- Node compatibility is a new ADR, not a patch.
