/**
 * The prose a tool result carries back to Claude where it depends on the
 * session kind (ADR 0011: an `outcome:` line, the facts, then the next step).
 * A grilling session is steered towards the frontier and its last round; an
 * offload session only ever hands answers back to whichever skill is running,
 * because that skill owns the ending (ADR 0021).
 */
import type { Answer, Round, SessionKind } from "./types.ts"

function describeAnswer(answer: Answer): string {
  switch (answer.kind) {
    case "recommended": {
      return "went with your recommendation"
    }
    case "option": {
      return `picked option (${answer.optionId ?? "?"})`
    }
    case "text": {
      return "wrote a manual answer"
    }
    default: {
      return "answered"
    }
  }
}

function formatAnswers(round: Round): string {
  return round.questions
    .map((q, i) => {
      const answer = round.answers[q.id]
      if (!answer) {
        return `Q${i + 1} ${q.title}: (unanswered)`
      }
      return `Q${i + 1} ${q.title} → ${answer.text}\n   (${describeAnswer(answer)})`
    })
    .join("\n")
}

const OPENED_NEXT_STEP: Record<SessionKind, string> = {
  grilling:
    "Next: run the grilling skill as usual, but instead of printing a round, call ask_round with the frontier " +
    "(numbered questions with title, body, options if any, and your recommendation), then loop on wait_for_answers " +
    "until it returns outcome: answered. Keep terminal output minimal; the browser is the conversation surface.",
  offload:
    "Next: keep running the skill you were running. Every time it would ask the user something, call ask_round " +
    "with that question (or the questions it would ask together), then loop on wait_for_answers until it returns " +
    "outcome: answered. Progress and results stay in the terminal; only the questions come here.",
}

const ANSWERED_NEXT_STEP: Record<SessionKind, string> = {
  grilling:
    "Next: recompute the frontier. If it is non-empty, ask_round again. If it is empty, run the last round: post_note " +
    "the full shared understanding, then ask ONE short question whose options are the four destinations — Just send " +
    "to Claude / /implement / /to-spec / /to-tickets — then close_session. The skill's 'The last round' section has " +
    "the rest: which to recommend, and what to do with the answer.",
  offload:
    "Next: hand these answers back to the skill you are running and carry on with it. When it asks the user " +
    "something again, ask_round again. When it reaches a step with nothing left to ask, call close_session; the " +
    "skill, not bbq, decides what happens after that.",
}

const CLOSED_REPORT: Record<SessionKind, string> = {
  grilling: "outcome: closed\nThe session was closed.",
  offload:
    "outcome: closed\nThe session was closed. Tell the user in one line, then ask any remaining questions in the " +
    "terminal. Do not open a new session on your own; the user can invoke bbq-offload again.",
}

export function openedNextStep(kind: SessionKind): string {
  return OPENED_NEXT_STEP[kind]
}

export function answeredReport(round: Round, kind: SessionKind): string {
  return [
    "outcome: answered",
    `round: ${round.index}`,
    "",
    formatAnswers(round),
    "",
    ANSWERED_NEXT_STEP[kind],
  ].join("\n")
}

export function closedReport(kind: SessionKind): string {
  return CLOSED_REPORT[kind]
}
