import { describe, expect, test } from "bun:test"

import { parseClientMessage } from "../src/protocol.ts"

describe("parseClientMessage", () => {
  test("accepts a well-formed answer", () => {
    const parsed = parseClientMessage(
      JSON.stringify({
        answer: { kind: "option", optionId: "a", text: "" },
        questionId: "r1q1",
        roundId: "r_1",
        type: "answer",
      })
    )
    expect(parsed.ok).toBe(true)
  })

  test("rejects malformed JSON", () => {
    expect(parseClientMessage("not json")).toEqual({
      error: "Malformed JSON",
      ok: false,
    })
  })

  test("rejects unknown message types", () => {
    const parsed = parseClientMessage(JSON.stringify({ type: "nope" }))
    expect(parsed.ok).toBe(false)
  })
})
