/**
 * Pure rules about a round, shared by the Store and the browser UI so both
 * sides agree on what can be answered and when a round is complete.
 */
import type { Round } from "./types.ts"

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

export function answeredCount(round: Round): number {
  return round.questions.filter((q) => round.answers[q.id] !== undefined).length
}
