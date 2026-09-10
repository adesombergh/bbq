---
status: accepted
---

# The browser never learns which skills Claude has, so the nudge travels inside the aside

The three aside buttons are always live. They are never disabled and they carry no "install this skill" tooltip, because the browser cannot know whether a skill is available and should not be told.

Availability is not installed-or-not. A skill reaches Claude from `~/.claude/skills`, from the project's `.claude/skills`, or from a plugin marketplace, and whether it is _invocable by the model_ is a separate property again: `wait-what` ships in `mattpocock-skills` with `disable-model-invocation: true`, so it is installed, enabled and permanently unreachable from a tool result. There are three states — not installed, installed but not model-invocable, installed and invocable — and only the third makes the skill branch in `asideInstruction` real. Every detection scheme we considered collapses them. A `readdir` over the two skill directories misses plugins entirely and would call `wait-what` available. A `Session.skills` field reported at `open_session` is honest about the third state, but it puts a new obligation in the `grill-ui` skill's Step 0, a new field in every snapshot, and a value that only ever feeds a tooltip.

Neither is needed, because a missing skill does not break anything. Each kind's **brief** in `src/aside-brief.ts` is the floor, not a fallback: it answers the aside on its own, and it is written for a grilling question where `show-me` and `eli5` are general-purpose. `wait-what` has run off its brief alone since it was written. So the nudge — _this would have been better with `show-me`, install it with …_ — is written by the only party that knows what it just used, at the end of the aside the person is already reading, for the only person the nudge is for. The install command is not composed: it is a string on the brief, quoted verbatim, because a confidently wrong install command is worse than none.

## Consequences

- No `skills` field on `Session`, no aside-availability in `ClientMessage`, no change to `ui/`. A future "just put it in the snapshot" proposal is refused here, on the same seam argument as ADR-0001 and ADR-0008: this is a capability of Claude's runtime, not state of the session.
- `skill` and `install` are optional on a brief and set together. A kind with no invocable skill (`wait-what`) gets the brief alone and no branch.
- Changing where `show-me` or `eli5` comes from is a one-line edit to `ASIDE_BRIEFS`, not a hope about what the model remembers.
- The three buttons look identical whatever is installed, so a person with no skills at all still gets three answers. They differ in craft, not in presence.
