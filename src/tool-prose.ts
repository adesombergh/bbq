/**
 * The prose every tool result carries back to Claude (ADR 0011: an `outcome:`
 * line, the facts, then the next step). Two things shape it: the session kind
 * — a grilling is steered towards the frontier and its last round, an offload
 * only ever hands answers back to whichever skill is running, because that
 * skill owns the ending (ADR 0021) — and whether Claude has already been told.
 * The protocol is taught in full once per session and recalled in one line
 * afterwards: the tool result is read by a model that keeps its context, so
 * repeating the lesson every round buys nothing and is paid for every time.
 */
import type { Answer, Aside, Round, Session, SessionKind } from "./types.ts"

import { ASIDE_BRIEFS, briefStep } from "./aside-brief.ts"
import { answeredCount } from "./round-rules.ts"
import { StateError } from "./state-error.ts"

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

/** Taught once, on the first round that comes back answered. */
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

/** Every round after the first: a reminder, not the lesson again. */
const ANSWERED_RECALL: Record<SessionKind, string> = {
  grilling:
    "Next: recompute the frontier — ask_round again, or run the last round if it is empty.",
  offload:
    "Next: hand these answers back to the skill you are running and carry on with it.",
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
  const nextStep =
    round.index === 1 ? ANSWERED_NEXT_STEP[kind] : ANSWERED_RECALL[kind]
  return [
    "outcome: answered",
    `round: ${round.index}`,
    "",
    formatAnswers(round),
    "",
    nextStep,
  ].join("\n")
}

export function closedReport(kind: SessionKind): string {
  return CLOSED_REPORT[kind]
}

/**
 * The poll that found nothing. It is the most repeated result of a session —
 * once per `wait_for_answers` timeout for as long as the user thinks — so it
 * stays two lines while a tab is connected, and spends words only on the case
 * that needs them: no browser to answer in.
 */
export function pendingReport(
  session: Session,
  round: Round,
  url: string
): string {
  const progress = `${answeredCount(round)}/${round.questions.length} answered`
  if (session.tabs === 0) {
    return [
      "outcome: pending",
      `${progress}, no browser connected. The user may have closed the tab; the URL is ${url}.`,
      "Call wait_for_answers again.",
    ].join("\n")
  }
  return [
    "outcome: pending",
    `${progress}, browser connected. Call wait_for_answers again.`,
  ].join("\n")
}

/**
 * The tab went away mid-wait. Reported as soon as it happens so the wait can
 * afford to be long: everything else that matters already wakes it.
 */
export function disconnectedReport(round: Round, url: string): string {
  return [
    "outcome: disconnected",
    `The browser tab closed with the round still open (${answeredCount(round)}/${round.questions.length} answered).`,
    `Tell the user in one line and give them the URL to reopen: ${url}`,
    "Then call wait_for_answers again; the page reconnects on load.",
  ].join("\n")
}

const FORMAT_RULE =
  'Pick the format that matches what you produced: "markdown" for prose, code, tables or a ```mermaid diagram; ' +
  '"html" for a fragment with inline CSS and no scripts or external resources, which renders in a sandboxed frame. ' +
  "Deliver it through post_aside — never write a file, never open one."

/**
 * The question an aside is about. Claude wrote it into `ask_round` minutes ago
 * and it is still in context, but a result has to stand on its own after a
 * compaction (ADR 0011) — so the body stays and the options are named, not
 * re-described. An aside may not add or change an option anyway.
 */
function questionSummary(round: Round, questionId: string): string {
  const question = round.questions.find((q) => q.id === questionId)
  if (!question) {
    throw new StateError(`Unknown question ${questionId}`)
  }
  const options =
    question.options.length > 0
      ? `\nOptions: ${question.options.map((o) => `(${o.id}) ${o.label}`).join(" · ")}`
      : "\n(open question, no fixed options)"
  const position = round.questions.indexOf(question) + 1
  return `Q${position} [${question.id}] — ${question.title}\n${question.body}${options}\nRecommendation: ${question.recommendation}`
}

export function asideInstruction(session: Session, aside: Aside): string {
  const round = session.rounds.find((r) => r.id === aside.roundId)
  if (!round) {
    throw new StateError(`Unknown round ${aside.roundId}`)
  }
  const spec = ASIDE_BRIEFS[aside.kind]
  return [
    "outcome: aside_requested",
    `The user pressed "${aside.kind}" on the question below and is waiting in the browser.`,
    "",
    questionSummary(round, aside.questionId),
    "",
    "Do this now:",
    `1. ${briefStep(spec)}`,
    `2. ${FORMAT_RULE}`,
    `3. Post the result with post_aside({ sessionId: "${session.id}", asideId: "${aside.id}", format, content }).`,
    "4. Call wait_for_answers again for the round.",
    "Do not answer in the terminal; the user is looking at the browser.",
  ].join("\n")
}
