import type { Aside } from "./types.ts"

/**
 * What each aside kind asks for. The brief is the floor, not a fallback: every
 * kind has one and an aside is answered from it alone when no skill applies.
 * `skill` is set only where Claude can actually invoke one — `wait-what` exists
 * as a skill but is `disable-model-invocation`, so it has none here. `install`
 * is quoted verbatim into the tool result so Claude never composes one. See
 * docs/adr/0015-skill-availability-is-not-session-state.md.
 *
 * The kind no longer fixes the `format`: since `show-me` became an external,
 * markdown-first skill, the answer is whatever it turned out to be, and Claude
 * names it on the call. See docs/adr/0006-html-asides-only-in-a-sandboxed-frame.md.
 */
export const ASIDE_BRIEFS: Record<
  Aside["kind"],
  { brief: string; install?: string; skill?: string }
> = {
  eli5: {
    brief:
      "Explain this question and its options like the reader knows nothing about the topic: a self-contained HTML fragment " +
      "with big simple pictures (inline SVG / emoji) and very few words, one concrete everyday analogy per option, and a " +
      "one-line 'so we pick…' for the recommendation. No scripts, no external resources, inline CSS only.",
    install: "/plugin install eli5@claude-community",
    skill: "eli5",
  },
  "show-me": {
    brief:
      "Make a visual for this question: something that shows the decision and how the options differ — a comparison, a flow, " +
      "an architecture sketch, a before/after — and mark the recommended option. Big shapes, few words. Either a ```mermaid " +
      "block (it is drawn for real in the panel) or a self-contained HTML fragment with inline <svg> / styled divs.",
    install: "npx skills add humanlayer/skills --skill show-me",
    skill: "show-me",
  },
  "wait-what": {
    brief:
      "Re-pitch this question so it lands: give a little context (why this decision matters now, what depends on it), " +
      "then restate the question, each option and your recommendation in ASD-STE100 Simplified Technical English: short " +
      "sentences, one idea per sentence, common words, active voice. Use the project's ubiquitous language (CONTEXT.md if present). " +
      "Do not add new options. Keep it under ~250 words.",
  },
}

export type AsideBrief = (typeof ASIDE_BRIEFS)[Aside["kind"]]

/**
 * Step 1 of the aside instruction. A kind with no invocable skill gets the
 * brief on its own; a kind with one gets the skill first and, when it turns out
 * to be missing, a one-line nudge quoting the install command from the brief.
 */
export function briefStep(spec: AsideBrief): string {
  if (spec.skill === undefined) {
    return `Follow this brief: ${spec.brief}`
  }
  const nudge =
    spec.install === undefined
      ? ""
      : ` If the skill was not available, end the aside with one line naming it and quoting this command exactly: ${spec.install}`
  return (
    `If the "${spec.skill}" skill is available, invoke it about this question. ` +
    `Otherwise follow this brief: ${spec.brief}${nudge}`
  )
}
