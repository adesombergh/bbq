import { describe, expect, test } from "bun:test"

import { sendsOnAnswer } from "../src/round-rules.ts"
import { Store } from "../src/state.ts"
import {
  answeredReport,
  closedReport,
  openedNextStep,
} from "../src/tool-prose.ts"

const q = (title: string) => ({
  body: `${title}?`,
  recommendation: "rec",
  title,
})

describe("session kind", () => {
  test("a session is a grilling unless it says otherwise", () => {
    const s = new Store()
    expect(s.createSession("t").kind).toBe("grilling")
    expect(s.createSession("t", undefined, "offload").kind).toBe("offload")
  })

  test("offload: answering the last open question sends the round", () => {
    const s = new Store()
    const session = s.createSession("t", undefined, "offload")
    const round = s.addRound(session.id, [q("A"), q("B")])

    s.setAnswer(session.id, round.id, "r1q1", { kind: "text", text: "one" })
    expect(round.status).toBe("open")

    s.setAnswer(session.id, round.id, "r1q2", { kind: "text", text: "two" })
    expect(round.status).toBe("submitted")
    expect(round.submittedAt).toBeNumber()
  })

  test("grilling: a complete round still waits for its own send", () => {
    const s = new Store()
    const session = s.createSession("t")
    const round = s.addRound(session.id, [q("A")])
    s.setAnswer(session.id, round.id, "r1q1", { kind: "text", text: "one" })
    expect(round.status).toBe("open")
  })
})

describe("sendsOnAnswer", () => {
  test("only an offload session with a complete open round sends itself", () => {
    const s = new Store()
    const offload = s.createSession("t", undefined, "offload")
    const round = s.addRound(offload.id, [q("A")])
    expect(sendsOnAnswer(offload, round)).toBe(false)

    const answered = {
      ...round,
      answers: { r1q1: { answeredAt: 1, kind: "text" as const, text: "x" } },
    }
    expect(sendsOnAnswer(offload, answered)).toBe(true)
    expect(sendsOnAnswer({ ...offload, kind: "grilling" }, answered)).toBe(
      false
    )
    expect(sendsOnAnswer(offload, { ...answered, status: "submitted" })).toBe(
      false
    )
  })
})

describe("tool prose", () => {
  const answeredRound = () => {
    const s = new Store()
    const session = s.createSession("t", undefined, "offload")
    const round = s.addRound(session.id, [q("Purpose")])
    s.setAnswer(session.id, round.id, "r1q1", { kind: "text", text: "speed" })
    return round
  }

  test("grilling keeps its frontier and its last round", () => {
    const report = answeredReport(answeredRound(), "grilling")
    expect(report).toStartWith("outcome: answered")
    expect(report).toContain("Q1 Purpose → speed")
    expect(report).toContain("recompute the frontier")
    expect(report).toContain("/to-tickets")
    expect(openedNextStep("grilling")).toContain("grilling skill")
  })

  test("offload hands the answers back and never mentions a last round", () => {
    const report = answeredReport(answeredRound(), "offload")
    expect(report).toStartWith("outcome: answered")
    expect(report).toContain("Q1 Purpose → speed")
    expect(report).toContain("close_session")
    for (const grillingOnly of ["frontier", "last round", "/implement"]) {
      expect(report).not.toContain(grillingOnly)
      expect(openedNextStep("offload")).not.toContain(grillingOnly)
    }
  })

  test("a closed offload session falls back to the terminal", () => {
    expect(closedReport("grilling")).toBe(
      "outcome: closed\nThe session was closed."
    )
    const offload = closedReport("offload")
    expect(offload).toStartWith("outcome: closed")
    expect(offload).toContain("terminal")
    expect(offload).toContain("Do not open a new session")
  })
})
