import { describe, expect, test } from "bun:test"

import { ASIDE_BRIEFS, briefStep } from "../src/aside-brief.ts"
import { ASIDE_KINDS } from "../src/types.ts"

describe("ASIDE_BRIEFS", () => {
  test("every kind has a brief: it is the floor, not a fallback", () => {
    for (const kind of ASIDE_KINDS) {
      expect(ASIDE_BRIEFS[kind].brief.length).toBeGreaterThan(0)
    }
  })

  test("wait-what names no skill: the one that exists is disable-model-invocation", () => {
    expect(ASIDE_BRIEFS["wait-what"].skill).toBeUndefined()
    expect(ASIDE_BRIEFS["wait-what"].install).toBeUndefined()
  })

  test("a kind that names a skill also carries how to install it", () => {
    for (const kind of ASIDE_KINDS) {
      const spec = ASIDE_BRIEFS[kind]
      if (spec.skill !== undefined) {
        expect(spec.install).toBeTruthy()
      }
    }
  })
})

describe("briefStep", () => {
  test("no skill: the brief alone, with no branch to hesitate over", () => {
    const step = briefStep(ASIDE_BRIEFS["wait-what"])
    expect(step).toStartWith("Follow this brief:")
    expect(step).not.toInclude("skill")
    expect(step).toInclude("ASD-STE100")
  })

  test("a skill: try it first, fall back to the brief, nudge with the exact command", () => {
    const step = briefStep(ASIDE_BRIEFS["show-me"])
    expect(step).toInclude('If the "show-me" skill is available')
    expect(step).toInclude("Otherwise follow this brief:")
    expect(step).toInclude("npx skills add humanlayer/skills --skill show-me")
  })

  test("the install command is quoted verbatim, never composed", () => {
    const install = "sudo make me a skill"
    const step = briefStep({ brief: "b", install, skill: "s" })
    expect(step).toEndWith(`quoting this command exactly: ${install}`)
  })

  test("a skill with no install command asks for no nudge", () => {
    const step = briefStep({ brief: "b", skill: "s" })
    expect(step).not.toInclude("If the skill was not available")
  })
})
