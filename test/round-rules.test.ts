import { describe, expect, test } from "bun:test"

import { tabLabel, tabState } from "../src/round-rules.ts"
import { Store } from "../src/state.ts"

const q = (title: string) => ({
  body: `${title}?`,
  recommendation: "rec",
  title,
})

describe("tabLabel", () => {
  test("no round yet: the short title alone", () => {
    const s = new Store()
    const session = s.createSession("A long descriptive title", "Theme switch")
    expect(tabState(session)).toBe("thinking")
    expect(tabLabel(session)).toBe("Theme switch")
  })

  test("open round: the count of questions still waiting on the person", () => {
    const s = new Store()
    const session = s.createSession("Theme switch")
    const round = s.addRound(session.id, [q("A"), q("B"), q("C")])
    expect(tabState(session)).toBe("awaiting")
    expect(tabLabel(session)).toBe("(3) Theme switch")

    s.setAnswer(session.id, round.id, "r1q1", { kind: "text", text: "yes" })
    expect(tabLabel(session)).toBe("(2) Theme switch")
  })

  test("an answered but unsent round is still the person's turn", () => {
    const s = new Store()
    const session = s.createSession("Theme switch")
    const round = s.addRound(session.id, [q("A")])
    s.setAnswer(session.id, round.id, "r1q1", { kind: "text", text: "yes" })
    // Sending is a click of its own, so the tab keeps asking for it; there is
    // just no count left to show.
    expect(tabState(session)).toBe("awaiting")
    expect(tabLabel(session)).toBe("Theme switch")

    s.submitRound(session.id, round.id)
    expect(tabState(session)).toBe("thinking")
    expect(tabLabel(session)).toBe("Theme switch")
  })

  test("a closed session is marked done, open round or not", () => {
    const s = new Store()
    const session = s.createSession("Theme switch")
    s.addRound(session.id, [q("A")])
    s.closeSession(session.id)
    expect(tabState(session)).toBe("closed")
    expect(tabLabel(session)).toBe("✓ Theme switch")
  })
})
