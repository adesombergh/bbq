---
status: accepted
---

# Three skill directories for one skill, because a skill has exactly one name

`skills/` holds `bbq`, `barbecue` and `churrasco`. Only the first is the skill. The other two are short stubs whose whole body is "invoke `bbq` and follow it exactly", and both carry `disable-model-invocation: true`.

This looks like a mistake, so here is why it is not. Skill frontmatter has no `aliases` field. The supported keys are `name`, `description`, `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context`, `agent`, `background`, `hooks`, `paths`, `shell`, `metadata`, `license` and `compatibility` — none of them aliasing. A skill's `name` **is** its slash command, one name per directory, and there is no second-name mechanism anywhere in the format. So a word that has to work as `/barbecue` has to be a directory called `barbecue`, or it does not work.

Two cheaper things were available and neither does the job asked for on its own. Naming the alternatives in the `bbq` description reaches the skill when someone _says_ "churrasco this" — description matching is real, and `bbq`'s description names all three words for that reason — but `/churrasco` does not exist, does not autocomplete, and typing it gets nothing; the ask was for the command. That naming is kept alongside the stubs, not instead of them. Slash commands in `.claude/commands/` give the literal `/barbecue` with autocomplete, but they are a second mechanism in a repo that has none, and `.claude/commands/` is not part of what the README tells people to install, so the alias would ship only to us. The stubs install exactly like the real skill does — copy or symlink — which is the only install story this project documents.

`disable-model-invocation: true` on the stubs is what keeps them from becoming a second way to describe the tool. Left open, three near-identical descriptions compete for whatever picks a skill, and Claude reaching a stub costs a wasted hop through a file whose only content is a pointer. One door for Claude, three for the person.

## Consequences

- Three directories under `skills/`, three symlinks under `.claude/skills/`, and a README install line that names all three.
- The stubs must never grow instructions of their own. Anything true about how a session runs belongs in `skills/bbq/SKILL.md`; a stub that starts explaining things is a fork waiting to drift. Each stub says so in its own body.
- `/barbecue` and `/churrasco` appear in the person's skill list beside `/bbq`. That is clutter, and it is the clutter that was asked for.
- A fourth word is a fourth directory. There is no configuration to add it to.
