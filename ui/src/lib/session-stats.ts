/**
 * The debrief's arithmetic: a pure function of the snapshot, so a closed
 * session debriefs the same in any tab, at any time. Nothing here is stored —
 * no `Session` field, no `ClientMessage`, no shape in `src/protocol.ts` — for
 * the same reason the pastime is not (docs/adr/0016-a-game-loop-needs-no-effect.md).
 *
 * It lives in `ui/src` rather than in `@shared/*` because Claude never reads
 * it: `close_session`'s tool result is unchanged. `test/debrief.test.ts`
 * imports this module under the root tsconfig, whose `lib` has no DOM in it,
 * so reaching for `window` or `Date.now()`-shaped state in here fails to
 * typecheck. The two numbers a page has to *watch* to know — time away and
 * time on the pastime — are not here; see `lib/away.ts` and `lib/pastime/store.ts`.
 */
import type { Round, Session } from "@shared/types"

const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS
const PERCENT = 100
const MINUTES_PER_HOUR = 60

/**
 * A tab is opened by the server the moment the session starts, but the browser
 * takes a moment to launch, so "opened with the session" is never instant.
 * Longer than this and the tab joined a session already under way.
 */
const OPENING_GRACE_MS = 30 * SECOND_MS

export interface Debrief {
  /** Asides asked, wherever they were asked. They are free, so they all count. */
  asides: number
  /** The whole span of the session: every lull included. The flattering one. */
  elapsedMs: number
  manualAnswers: number
  /** Answered questions in counted rounds: the denominator for the mix. */
  questions: number
  recommendationTaken: number
  /** The stretch a round was open: the time the ball was in your court. */
  roundOpenMs: number
  rounds: number
}

/**
 * The rounds the debrief counts: submitted ones, minus the last round of a
 * tidy grilling. That round confirms the shared understanding and names the
 * destination; the question budget already treats it as free, and a debrief
 * that contradicts the budget's arithmetic is one that has to be explained.
 *
 * It is found by position, never by recognising the four destination labels:
 * the destination menu is the skill's business (ADR 0015) and a French session
 * language would break the match outright. Position is wrong only on a session
 * closed early, where one answer's drift in a ratio is not what went wrong.
 */
function countedRounds(session: Session): Round[] {
  const submitted = session.rounds.filter(
    (round) => round.status === "submitted"
  )
  const endedTidily =
    session.kind === "grilling" &&
    session.status === "closed" &&
    submitted.length === session.rounds.length
  return endedTidily ? submitted.slice(0, -1) : submitted
}

export function debrief(session: Session): Debrief {
  const end = session.closedAt ?? session.createdAt
  const rounds = countedRounds(session)
  let questions = 0
  let recommendationTaken = 0
  let manualAnswers = 0
  for (const round of rounds) {
    for (const question of round.questions) {
      const answer = round.answers[question.id]
      if (answer === undefined) {
        continue
      }
      questions += 1
      if (answer.kind === "text") {
        manualAnswers += 1
      }
      // Picking the option that *is* the recommendation is the same decision
      // reached by a different press, so it counts the same.
      if (
        answer.kind === "recommended" ||
        (answer.optionId !== undefined &&
          answer.optionId === question.recommendedOptionId)
      ) {
        recommendationTaken += 1
      }
    }
  }
  const roundOpenMs = session.rounds.reduce(
    (total, round) => total + ((round.submittedAt ?? end) - round.createdAt),
    0
  )
  return {
    asides: session.asides.length,
    elapsedMs: end - session.createdAt,
    manualAnswers,
    questions,
    recommendationTaken,
    roundOpenMs,
    rounds: rounds.length,
  }
}

/** One stretch this page spent hidden, as `lib/away.ts` watched it happen. */
export interface AwaySpan {
  from: number
  to: number
}

/**
 * Whether this page and this session started together. What a page watches
 * happen lives in one page's memory, so a tab that joined late — or one you
 * refreshed — would report a share of a session it did not see, and nothing
 * in the rendering would let the reader tell.
 *
 * The test is two-sided on purpose. A page older than the session did see all
 * of it, but it also watched whatever came before: the pastime's total is for
 * the life of the page, so an earlier session's snake would be reported as
 * this one's.
 */
export function sawWholeSession(session: Session, openedAt: number): boolean {
  return Math.abs(openedAt - session.createdAt) <= OPENING_GRACE_MS
}

/**
 * Hidden time that fell inside the session's own span. A closed tab is meant
 * to be kept, so the away clock keeps running long after `elapsedMs` has
 * stopped — without this clamp, an afternoon away from a finished session
 * reports as several hundred percent of it.
 */
export function awayWithin(
  spans: AwaySpan[],
  from: number,
  to: number
): number {
  let total = 0
  for (const span of spans) {
    const start = Math.max(span.from, from)
    const end = Math.min(span.to, to)
    total += Math.max(end - start, 0)
  }
  return total
}

/** A whole-number share, and never a division by zero. */
export function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * PERCENT)
}

/** A duration as a person would say it: `45s`, `38m`, `1h 12m`. */
export function formatDuration(ms: number): string {
  if (ms < MINUTE_MS) {
    // Floored like the minutes below, and for the same reason: rounding here
    // is also the one way this branch could ever print "60s".
    return `${Math.floor(ms / SECOND_MS)}s`
  }
  // Floored, not rounded: a debrief that says 2m for 90 seconds reads as a
  // number that has been massaged.
  const minutes = Math.floor(ms / MINUTE_MS)
  if (ms < HOUR_MS) {
    return `${minutes}m`
  }
  return `${Math.floor(minutes / MINUTES_PER_HOUR)}h ${minutes % MINUTES_PER_HOUR}m`
}
