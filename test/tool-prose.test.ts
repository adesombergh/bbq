import { describe, expect, test } from "bun:test"

import { Store } from "../src/state.ts"
import {
  answeredReport,
  asideInstruction,
  disconnectedReport,
  pendingReport,
} from "../src/tool-prose.ts"

const URL = "http://127.0.0.1:1234/s/abc?t=tok"

const q = (
  title: string,
  options?: { description?: string; label: string }[]
) => ({
  body: `${title}?`,
  options,
  recommendation: "rec",
  title,
})

const session = (kind?: "grilling" | "offload") => {
  const store = new Store()
  return { session: store.createSession("t", undefined, kind), store }
}

describe("answeredReport teaches once", () => {
  test("round 1 carries the whole protocol", () => {
    const { session: s, store } = session()
    const round = store.addRound(s.id, [q("Purpose")])
    store.setAnswer(s.id, round.id, "r1q1", { kind: "text", text: "speed" })

    const report = answeredReport(round, "grilling")
    expect(report).toContain("post_note")
    expect(report).toContain("/to-tickets")
  })

  test("later rounds get a one-line recall, not the lesson again", () => {
    const { session: s, store } = session()
    const first = store.addRound(s.id, [q("First")])
    store.setAnswer(s.id, first.id, "r1q1", { kind: "text", text: "done" })
    store.submitRound(s.id, first.id)
    const round = store.addRound(s.id, [q("Second")])
    store.setAnswer(s.id, round.id, "r2q1", { kind: "text", text: "speed" })

    const report = answeredReport(round, "grilling")
    expect(round.index).toBe(2)
    expect(report).toStartWith("outcome: answered")
    expect(report).toContain("Q1 Second → speed")
    expect(report).toContain("recompute the frontier")
    expect(report).not.toContain("/to-tickets")
    expect(report.length).toBeLessThan(
      answeredReport({ ...round, index: 1 }, "grilling").length
    )
  })

  test("the recall still names the next tool for an offload", () => {
    const { session: s, store } = session("offload")
    const first = store.addRound(s.id, [q("First")])
    store.setAnswer(s.id, first.id, "r1q1", { kind: "text", text: "done" })
    store.submitRound(s.id, first.id)
    const round = store.addRound(s.id, [q("Second")])
    store.setAnswer(s.id, round.id, "r2q1", { kind: "text", text: "yes" })

    const report = answeredReport(round, "offload")
    expect(report).toContain("hand these answers back")
    expect(report).not.toContain("frontier")
  })
})

describe("pendingReport", () => {
  test("a connected tab gets two lines: it is the most repeated result", () => {
    const { session: s, store } = session()
    const round = store.addRound(s.id, [q("A"), q("B")])
    store.setTabs(s.id, 1)

    const report = pendingReport(store.get(s.id), round, URL)
    expect(report.split("\n")).toHaveLength(2)
    expect(report).toStartWith("outcome: pending")
    expect(report).toContain("0/2 answered")
    expect(report).not.toContain(URL)
  })

  test("no tab spends the words it needs: the URL to reopen", () => {
    const { session: s, store } = session()
    const round = store.addRound(s.id, [q("A")])

    const report = pendingReport(store.get(s.id), round, URL)
    expect(report).toContain("no browser connected")
    expect(report).toContain(URL)
  })
})

describe("disconnectedReport", () => {
  test("names the progress lost and the URL to reopen", () => {
    const { session: s, store } = session()
    const round = store.addRound(s.id, [q("A"), q("B")])
    store.setAnswer(s.id, round.id, "r1q1", { kind: "text", text: "one" })

    const report = disconnectedReport(round, URL)
    expect(report).toStartWith("outcome: disconnected")
    expect(report).toContain("1/2 answered")
    expect(report).toContain(URL)
    expect(report).toContain("wait_for_answers")
  })
})

describe("asideInstruction", () => {
  const requested = () => {
    const { session: s, store } = session()
    const round = store.addRound(s.id, [
      q("Transport", [
        { description: "the hub pushes every frame", label: "WebSocket" },
        { description: "less plumbing, one direction", label: "SSE" },
      ]),
    ])
    const aside = store.requestAside(s.id, round.id, "r1q1", "show-me")
    return { aside, session: store.get(s.id) }
  }

  test("the question stands on its own after a compaction", () => {
    const { aside, session: s } = requested()
    const out = asideInstruction(s, aside)
    expect(out).toStartWith("outcome: aside_requested")
    expect(out).toContain("Q1 [r1q1] — Transport")
    expect(out).toContain("Transport?")
    expect(out).toContain("Recommendation: rec")
    expect(out).toContain(`asideId: "${aside.id}"`)
  })

  test("options are named, not re-described: an aside may not change them", () => {
    const { aside, session: s } = requested()
    const out = asideInstruction(s, aside)
    expect(out).toContain("Options: (a) WebSocket · (b) SSE")
    expect(out).not.toContain("the hub pushes every frame")
    expect(out).not.toContain("less plumbing")
  })

  test("an open question says so rather than listing nothing", () => {
    const { session: s, store } = session()
    const round = store.addRound(s.id, [q("Why")])
    const aside = store.requestAside(s.id, round.id, "r1q1", "wait-what")
    expect(asideInstruction(store.get(s.id), aside)).toContain(
      "(open question, no fixed options)"
    )
  })
})
