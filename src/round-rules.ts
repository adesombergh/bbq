/**
 * Pure rules about a round, shared by the Store and the browser UI so both
 * sides agree on what can be answered and when a round is complete.
 */
import type { Round, Session } from "./types.ts"

/**
 * Gating rule: question N can be answered only once every earlier question
 * in the round has an answer. Changing an already-answered question is
 * always allowed while the round is open.
 */
export function canAnswer(round: Round, questionId: string): boolean {
  if (round.status !== "open") {
    return false
  }
  const idx = round.questions.findIndex((q) => q.id === questionId)
  if (idx === -1) {
    return false
  }
  return round.questions
    .slice(0, idx)
    .every((q) => round.answers[q.id] !== undefined)
}

export function isComplete(round: Round): boolean {
  return round.questions.every((q) => round.answers[q.id] !== undefined)
}

/**
 * Offload auto-send: in an offload session the answer that completes an open
 * round is also its send. A grilling round always waits for its own press.
 */
export function sendsOnAnswer(session: Session, round: Round): boolean {
  return (
    session.kind === "offload" && round.status === "open" && isComplete(round)
  )
}

export function answeredCount(round: Round): number {
  return round.questions.filter((q) => round.answers[q.id] !== undefined).length
}

export function unansweredCount(round: Round): number {
  return round.questions.length - answeredCount(round)
}

export type TabState = "awaiting" | "thinking" | "closed"

function openRound(session: Session): Round | undefined {
  return session.rounds.find((r) => r.status === "open")
}

/**
 * Whose turn the session is on, as the browser tab reports it: an open round is
 * the person's turn until they send it (answering the last question is not the
 * last action), otherwise Claude is thinking, unless the session is over.
 */
export function tabState(session: Session): TabState {
  if (session.status === "closed") {
    return "closed"
  }
  return openRound(session) ? "awaiting" : "thinking"
}

/** The browser tab title: the short title, marked with whose turn it is. */
export function tabLabel(session: Session): string {
  if (session.status === "closed") {
    return `✓ ${session.shortTitle}`
  }
  const open = openRound(session)
  const waiting = open ? unansweredCount(open) : 0
  return waiting > 0 ? `(${waiting}) ${session.shortTitle}` : session.shortTitle
}
