import { describe, expect, test } from "bun:test"

import { StateError } from "../src/state-error.ts"
import { Store } from "../src/state.ts"

const SHORT_TIMEOUT_MS = 30
const LONG_TIMEOUT_MS = 5000

const q = (title: string, opts?: string[], rec?: string) => ({
  body: `${title}?`,
  options: opts?.map((label) => ({ label })),
  recommendation: "rec",
  recommendedOptionId: rec,
  title,
})

describe("Store", () => {
  test("round lifecycle with gating", () => {
    const s = new Store()
    const sess = s.createSession("t")
    const r = s.addRound(sess.id, [q("A", ["x", "y"], "b"), q("B")])
    expect(r.questions.map((x) => x.id)).toEqual(["r1q1", "r1q2"])
    expect(r.questions[0]?.options.map((o) => o.id)).toEqual(["a", "b"])

    // Q2 locked until Q1 answered
    expect(() =>
      s.setAnswer(sess.id, r.id, "r1q2", { kind: "text", text: "hi" })
    ).toThrow(StateError)
    expect(() => s.submitRound(sess.id, r.id)).toThrow(StateError)

    s.setAnswer(sess.id, r.id, "r1q1", { kind: "recommended", text: "" })
    expect(r.answers.r1q1).toMatchObject({
      kind: "recommended",
      optionId: "b",
      text: "y",
    })

    // change answer is allowed
    s.setAnswer(sess.id, r.id, "r1q1", {
      kind: "option",
      optionId: "a",
      text: "",
    })
    expect(r.answers.r1q1?.text).toBe("x")

    s.setAnswer(sess.id, r.id, "r1q2", { kind: "text", text: "free" })
    s.submitRound(sess.id, r.id)
    expect(r.status).toBe("submitted")
    expect(() =>
      s.setAnswer(sess.id, r.id, "r1q1", {
        kind: "option",
        optionId: "b",
        text: "",
      })
    ).toThrow(/submitted/u)

    // second round now allowed
    const r2 = s.addRound(sess.id, [q("C")])
    expect(r2.index).toBe(2)
  })

  test("only one open round at a time", () => {
    const s = new Store()
    const sess = s.createSession("t")
    s.addRound(sess.id, [q("A")])
    expect(() => s.addRound(sess.id, [q("B")])).toThrow(/still open/u)
  })

  test("validates recommendedOptionId", () => {
    const s = new Store()
    const sess = s.createSession("t")
    expect(() => s.addRound(sess.id, [q("A", ["x"], "zz")])).toThrow(
      /not one of the options/u
    )
  })

  test("asides coalesce while in flight and resolve", () => {
    const s = new Store()
    const sess = s.createSession("t")
    const r = s.addRound(sess.id, [q("A")])
    const a1 = s.requestAside(sess.id, r.id, "r1q1", "eli5")
    const a2 = s.requestAside(sess.id, r.id, "r1q1", "eli5")
    expect(a2.id).toBe(a1.id)
    expect(s.pendingAsides(sess.id)).toHaveLength(1)
    s.claimAside(sess.id, a1.id)
    expect(s.pendingAsides(sess.id)).toHaveLength(0)
    s.resolveAside(sess.id, a1.id, "markdown", "hello")
    expect(s.getAside(sess.id, a1.id)).toMatchObject({
      content: "hello",
      status: "resolved",
    })
    // a new request after resolution creates a fresh aside
    const a3 = s.requestAside(sess.id, r.id, "r1q1", "eli5")
    expect(a3.id).not.toBe(a1.id)
  })

  test("waitFor resolves on change and times out otherwise", async () => {
    const s = new Store()
    const sess = s.createSession("t")
    const r = s.addRound(sess.id, [q("A")])

    const timedOut = await s.waitFor(
      sess.id,
      (x) => (x.rounds[0]?.status === "submitted" ? true : undefined),
      SHORT_TIMEOUT_MS
    )
    expect(timedOut).toBeUndefined()

    const p = s.waitFor(
      sess.id,
      (x) => (x.rounds[0]?.status === "submitted" ? "done" : undefined),
      LONG_TIMEOUT_MS
    )
    s.setAnswer(sess.id, r.id, "r1q1", { kind: "text", text: "ok" })
    s.submitRound(sess.id, r.id)
    expect(await p).toBe("done")
  })

  test("apply routes client messages", () => {
    const s = new Store()
    const sess = s.createSession("t")
    const r = s.addRound(sess.id, [q("A", ["x"])])
    s.apply(sess.id, {
      answer: { kind: "option", optionId: "a", text: "" },
      questionId: "r1q1",
      roundId: r.id,
      type: "answer",
    })
    expect(r.answers.r1q1?.text).toBe("x")
    s.apply(sess.id, {
      questionId: "r1q1",
      roundId: r.id,
      type: "clear_answer",
    })
    expect(r.answers.r1q1).toBeUndefined()
  })
})
