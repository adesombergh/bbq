import type { Answer, Question, Round, Session } from "../src/types.ts"

import { describe, expect, test } from "bun:test"

import {
  awayWithin,
  debrief,
  formatDuration,
  percent,
  sawWholeSession,
} from "../ui/src/lib/session-stats"

const SECOND = 1000
const MINUTE = 60 * SECOND

const question = (id: string, recommended?: string): Question => ({
  body: "…",
  id,
  options: [
    { id: "a", label: "One" },
    { id: "b", label: "Two" },
  ],
  recommendation: "…",
  recommendedOptionId: recommended,
  title: id,
})

const answer = (
  kind: Answer["kind"],
  optionId?: string,
  answeredAt = 0
): Answer => ({
  answeredAt,
  kind,
  optionId,
  text: kind,
})

const round = (
  index: number,
  questions: Question[],
  answers: Record<string, Answer>,
  span: { createdAt: number; submittedAt?: number }
): Round => ({
  answers,
  createdAt: span.createdAt,
  id: `r${index}`,
  index,
  questions,
  status: span.submittedAt === undefined ? "open" : "submitted",
  submittedAt: span.submittedAt,
})

const session = (parts: Partial<Session>): Session => ({
  asides: [],
  closedAt: 10 * MINUTE,
  createdAt: 0,
  id: "s",
  kind: "grilling",
  notes: [],
  rounds: [],
  shortTitle: "s",
  status: "closed",
  tabs: 1,
  title: "s",
  ...parts,
})

/** Two ordinary rounds plus the last round, the shape a tidy grilling ends in. */
const tidyGrilling = (): Session =>
  session({
    rounds: [
      round(
        1,
        [question("q1", "a"), question("q2", "b")],
        { q1: answer("recommended", "a"), q2: answer("option", "a") },
        { createdAt: 0, submittedAt: 1 * MINUTE }
      ),
      round(
        2,
        [question("q3", "a"), question("q4")],
        { q3: answer("option", "a"), q4: answer("text") },
        { createdAt: 5 * MINUTE, submittedAt: 7 * MINUTE }
      ),
      round(
        3,
        [question("q5", "b")],
        { q5: answer("recommended", "b") },
        { createdAt: 9 * MINUTE, submittedAt: 10 * MINUTE }
      ),
    ],
  })

describe("debrief", () => {
  test("counts the rounds and questions that were asked, not the last round", () => {
    const stats = debrief(tidyGrilling())
    // Rounds 1 and 2; round 3 is the destination question, free like it is
    // for the question budget.
    expect(stats.rounds).toBe(2)
    expect(stats.questions).toBe(4)
  })

  test("an option that happens to be the recommended one counts as taking it", () => {
    const stats = debrief(tidyGrilling())
    // q1 answered `recommended`, q3 picked option "a" which *is* the
    // recommendation. q2 picked "a" where "b" was recommended; q4 is manual.
    expect(stats.recommendationTaken).toBe(2)
    expect(stats.manualAnswers).toBe(1)
  })

  test("an offload counts its final round like any other", () => {
    const stats = debrief(session({ ...tidyGrilling(), kind: "offload" }))
    expect(stats.rounds).toBe(3)
    expect(stats.questions).toBe(5)
  })

  test("an unsubmitted round does not count", () => {
    const stats = debrief(
      session({
        rounds: [
          round(
            1,
            [question("q1", "a")],
            { q1: answer("recommended", "a") },
            { createdAt: 0, submittedAt: 1 * MINUTE }
          ),
          round(2, [question("q2", "a")], {}, { createdAt: 2 * MINUTE }),
        ],
      })
    )
    // Only the submitted round counts, and it is not exempted as the last
    // round: a session that was closed early never reached one.
    expect(stats.rounds).toBe(1)
    expect(stats.questions).toBe(1)
  })

  test("an answered question in an open round does not count", () => {
    const stats = debrief(
      session({
        rounds: [
          round(
            1,
            [question("q1", "a"), question("q2", "a")],
            { q1: answer("text") },
            { createdAt: 0 }
          ),
        ],
      })
    )
    expect(stats.questions).toBe(0)
    expect(stats.manualAnswers).toBe(0)
  })

  test("elapsed frames the time a round was open", () => {
    const stats = debrief(tidyGrilling())
    expect(stats.elapsedMs).toBe(10 * MINUTE)
    // 0→1, 5→7 and 9→10: the gaps between are lull.
    expect(stats.roundOpenMs).toBe(4 * MINUTE)
  })

  test("a round still open at close was open until the close", () => {
    const stats = debrief(
      session({
        closedAt: 4 * MINUTE,
        rounds: [round(1, [question("q1")], {}, { createdAt: 1 * MINUTE })],
      })
    )
    expect(stats.roundOpenMs).toBe(3 * MINUTE)
  })

  test("asides are counted whichever round they were asked on", () => {
    const stats = debrief(
      session({
        ...tidyGrilling(),
        asides: [
          {
            id: "a1",
            kind: "eli5",
            questionId: "q1",
            requestedAt: 1,
            roundId: "r1",
            status: "resolved",
          },
          {
            id: "a2",
            kind: "show-me",
            questionId: "q5",
            requestedAt: 2,
            roundId: "r3",
            status: "requested",
          },
        ],
      })
    )
    // Including the one asked on the last round: asides are free everywhere.
    expect(stats.asides).toBe(2)
  })

  test("an empty session debriefs to zeroes rather than to NaN", () => {
    const stats = debrief(session({ closedAt: 0 }))
    expect(stats).toEqual({
      asides: 0,
      elapsedMs: 0,
      manualAnswers: 0,
      questions: 0,
      recommendationTaken: 0,
      roundOpenMs: 0,
      rounds: 0,
    })
    expect(percent(stats.recommendationTaken, stats.questions)).toBe(0)
  })
})

describe("sawWholeSession", () => {
  test("a tab opened with the session saw all of it", () => {
    // The browser takes a moment to launch, so opening is never instant.
    expect(sawWholeSession(session({ createdAt: 1000 }), 3500)).toBe(true)
  })

  test("a tab opened minutes later did not", () => {
    expect(sawWholeSession(session({ createdAt: 1000 }), 5 * MINUTE)).toBe(
      false
    )
  })

  test("a page older than the session does not count either", () => {
    // It saw all of this session, but what it watched before this session
    // started is in the same totals — an earlier session's snake included.
    expect(sawWholeSession(session({ createdAt: 10 * MINUTE }), 0)).toBe(false)
  })
})

describe("awayWithin", () => {
  const spans = [
    { from: 2 * MINUTE, to: 4 * MINUTE },
    { from: 9 * MINUTE, to: 20 * MINUTE },
  ]

  test("only the stretch inside the session counts", () => {
    // The session ends at 10m, so the second stretch contributes one minute
    // and not eleven: a closed tab is meant to be kept, and an afternoon away
    // from a finished session is not away.
    expect(awayWithin(spans, 0, 10 * MINUTE)).toBe(3 * MINUTE)
  })

  test("a stretch entirely outside the window contributes nothing", () => {
    expect(awayWithin(spans, 5 * MINUTE, 8 * MINUTE)).toBe(0)
  })

  test("never hidden is no time away", () => {
    expect(awayWithin([], 0, 10 * MINUTE)).toBe(0)
  })
})

describe("formatting", () => {
  test("durations read as a person would say them", () => {
    expect(formatDuration(0)).toBe("0s")
    // Never "60s": the seconds branch floors, like the minutes branch.
    expect(formatDuration(59.6 * SECOND)).toBe("59s")
    expect(formatDuration(45 * SECOND)).toBe("45s")
    expect(formatDuration(90 * SECOND)).toBe("1m")
    expect(formatDuration(38 * MINUTE)).toBe("38m")
    expect(formatDuration(72 * MINUTE)).toBe("1h 12m")
  })

  test("percent rounds and never divides by zero", () => {
    expect(percent(11, 12)).toBe(92)
    expect(percent(0, 0)).toBe(0)
  })
})
