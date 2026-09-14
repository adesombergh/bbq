/**
 * In-memory session state. This is the seam of the whole design:
 * - the MCP tools (src/mcp.ts) only ever read/mutate state and `waitFor` changes,
 * - the WS hub (src/hub.ts) only subscribes to state and applies client messages.
 * Neither side knows about the other.
 */
import type {
  Answer,
  Aside,
  AsideKind,
  ClientMessage,
  Note,
  Question,
  Round,
  Session,
  SessionKind,
} from "./types.ts"

import { canAnswer, isComplete, sendsOnAnswer } from "./round-rules.ts"
import { StateError } from "./state-error.ts"

type Listener = (session: Session) => void

const ID_LENGTH = 8
const LETTER_A = 97
/** A browser tab shows about this much of a title before cutting it off. */
const SHORT_TITLE_MAX = 40

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" })

/** Keep a tab label short whatever the caller sent. Cuts between graphemes, so
 *  an emoji or an accented character is never sliced in half. */
function shorten(value: string): string {
  const trimmed = value.trim()
  const chars = [...graphemes.segment(trimmed)].map((part) => part.segment)
  if (chars.length <= SHORT_TITLE_MAX) {
    return trimmed
  }
  return `${chars
    .slice(0, SHORT_TITLE_MAX - 1)
    .join("")
    .trimEnd()}…`
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, ID_LENGTH)}`
}

/** Option ids default to a, b, c… */
function defaultOptionId(index: number): string {
  return String.fromCodePoint(LETTER_A + index)
}

export interface QuestionInput {
  id?: string
  title: string
  body: string
  options?: { id?: string; label: string; description?: string }[]
  recommendation: string
  recommendedOptionId?: string
}

function buildQuestion(
  input: QuestionInput,
  index: number,
  roundIndex: number
): Question {
  const options = (input.options ?? []).map((o, j) => ({
    description: o.description,
    id: o.id ?? defaultOptionId(j),
    label: o.label,
  }))
  const ids = new Set(options.map((o) => o.id))
  if (ids.size !== options.length) {
    throw new StateError(`Duplicate option ids in question ${index + 1}`)
  }
  const { recommendedOptionId } = input
  if (recommendedOptionId !== undefined && !ids.has(recommendedOptionId)) {
    throw new StateError(
      `Question ${index + 1}: recommendedOptionId "${recommendedOptionId}" is not one of the options`
    )
  }
  return {
    body: input.body,
    id: input.id ?? `r${roundIndex}q${index + 1}`,
    options,
    recommendation: input.recommendation,
    recommendedOptionId,
    title: input.title,
  }
}

function resolveAnswer(
  question: Question,
  answer: Omit<Answer, "answeredAt">
): Answer {
  const answeredAt = Date.now()
  switch (answer.kind) {
    case "recommended": {
      const { recommendedOptionId } = question
      if (recommendedOptionId === undefined) {
        return {
          answeredAt,
          kind: "recommended",
          text: question.recommendation,
        }
      }
      const option = question.options.find((o) => o.id === recommendedOptionId)
      return {
        answeredAt,
        kind: "recommended",
        optionId: recommendedOptionId,
        text: option?.label ?? question.recommendation,
      }
    }
    case "option": {
      const option = question.options.find((o) => o.id === answer.optionId)
      if (!option) {
        throw new StateError(`Unknown option ${answer.optionId ?? "(none)"}`)
      }
      return {
        answeredAt,
        kind: "option",
        optionId: option.id,
        text: option.label,
      }
    }
    case "text": {
      if (answer.text.trim() === "") {
        throw new StateError("Empty answer")
      }
      return { answeredAt, kind: "text", text: answer.text }
    }
    default: {
      throw new StateError("Unknown answer kind")
    }
  }
}

export class Store {
  private readonly sessions = new Map<string, Session>()
  private readonly listeners = new Map<string, Set<Listener>>()

  /* ---------- sessions ---------- */

  createSession(
    title: string,
    shortTitle?: string,
    kind: SessionKind = "grilling"
  ): Session {
    // A blank short title is no short title: the full one is the fallback.
    const short = shortTitle?.trim()
    const session: Session = {
      asides: [],
      createdAt: Date.now(),
      id: newId("s"),
      kind,
      notes: [],
      rounds: [],
      shortTitle: shorten(short === undefined || short === "" ? title : short),
      status: "open",
      tabs: 0,
      title,
    }
    this.sessions.set(session.id, session)
    return session
  }

  get(sessionId: string): Session {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new StateError(`Unknown session ${sessionId}`)
    }
    return session
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  list(): Session[] {
    return [...this.sessions.values()]
  }

  closeSession(sessionId: string): Session {
    const session = this.get(sessionId)
    if (session.status === "open") {
      session.status = "closed"
      session.closedAt = Date.now()
      this.emit(session)
    }
    return session
  }

  setTabs(sessionId: string, delta: number): Session {
    const session = this.get(sessionId)
    session.tabs = Math.max(0, session.tabs + delta)
    this.emit(session)
    return session
  }

  /* ---------- rounds ---------- */

  addRound(
    sessionId: string,
    questions: QuestionInput[],
    intro?: string
  ): Round {
    const session = this.get(sessionId)
    if (session.status !== "open") {
      throw new StateError("Session is closed")
    }
    if (questions.length === 0) {
      throw new StateError("A round needs at least one question")
    }
    const open = session.rounds.find((r) => r.status === "open")
    if (open) {
      throw new StateError(
        `Round ${open.id} is still open; wait for it before asking another`
      )
    }

    const roundIndex = session.rounds.length + 1
    const built = questions.map((q, i) => buildQuestion(q, i, roundIndex))
    const questionIds = new Set(built.map((q) => q.id))
    if (questionIds.size !== built.length) {
      throw new StateError("Duplicate question ids")
    }

    const round: Round = {
      answers: {},
      createdAt: Date.now(),
      id: newId("r"),
      index: roundIndex,
      intro,
      questions: built,
      status: "open",
    }
    session.rounds.push(round)
    this.emit(session)
    return round
  }

  getRound(sessionId: string, roundId: string): Round {
    const round = this.get(sessionId).rounds.find((r) => r.id === roundId)
    if (!round) {
      throw new StateError(`Unknown round ${roundId}`)
    }
    return round
  }

  /** Find the session owning a round. */
  findRound(roundId: string): { session: Session; round: Round } {
    for (const session of this.sessions.values()) {
      const round = session.rounds.find((r) => r.id === roundId)
      if (round) {
        return { round, session }
      }
    }
    throw new StateError(`Unknown round ${roundId}`)
  }

  setAnswer(
    sessionId: string,
    roundId: string,
    questionId: string,
    answer: Omit<Answer, "answeredAt">
  ): Round {
    const session = this.get(sessionId)
    const round = this.getRound(sessionId, roundId)
    if (round.status !== "open") {
      throw new StateError("Round already submitted")
    }
    const question = round.questions.find((q) => q.id === questionId)
    if (!question) {
      throw new StateError(`Unknown question ${questionId}`)
    }
    if (!canAnswer(round, questionId)) {
      throw new StateError("Answer the previous questions first")
    }
    round.answers[questionId] = resolveAnswer(question, answer)
    if (sendsOnAnswer(session, round)) {
      round.status = "submitted"
      round.submittedAt = Date.now()
    }
    this.emit(session)
    return round
  }

  clearAnswer(sessionId: string, roundId: string, questionId: string): Round {
    const session = this.get(sessionId)
    const round = this.getRound(sessionId, roundId)
    if (round.status !== "open") {
      throw new StateError("Round already submitted")
    }
    round.answers = Object.fromEntries(
      Object.entries(round.answers).filter(([id]) => id !== questionId)
    )
    this.emit(session)
    return round
  }

  submitRound(sessionId: string, roundId: string): Round {
    const session = this.get(sessionId)
    const round = this.getRound(sessionId, roundId)
    if (round.status !== "open") {
      return round
    }
    if (!isComplete(round)) {
      throw new StateError("Answer every question before submitting")
    }
    round.status = "submitted"
    round.submittedAt = Date.now()
    this.emit(session)
    return round
  }

  /* ---------- asides (wait-what / show-me / eli5) ---------- */

  requestAside(
    sessionId: string,
    roundId: string,
    questionId: string,
    kind: AsideKind
  ): Aside {
    const session = this.get(sessionId)
    const round = this.getRound(sessionId, roundId)
    if (!round.questions.some((q) => q.id === questionId)) {
      throw new StateError(`Unknown question ${questionId}`)
    }
    // Coalesce: one in-flight aside per (question, kind).
    const existing = session.asides.find(
      (a) =>
        a.questionId === questionId &&
        a.kind === kind &&
        (a.status === "requested" || a.status === "claimed")
    )
    if (existing) {
      return existing
    }
    const aside: Aside = {
      id: newId("a"),
      kind,
      questionId,
      requestedAt: Date.now(),
      roundId,
      status: "requested",
    }
    session.asides.push(aside)
    this.emit(session)
    return aside
  }

  /** Mark an aside as being worked on by Claude (so the UI can show progress). */
  claimAside(sessionId: string, asideId: string): Aside {
    const session = this.get(sessionId)
    const aside = this.getAside(sessionId, asideId)
    if (aside.status === "requested") {
      aside.status = "claimed"
      this.emit(session)
    }
    return aside
  }

  resolveAside(
    sessionId: string,
    asideId: string,
    format: "markdown" | "html",
    content: string
  ): Aside {
    const session = this.get(sessionId)
    const aside = this.getAside(sessionId, asideId)
    aside.status = "resolved"
    aside.format = format
    aside.content = content
    aside.resolvedAt = Date.now()
    this.emit(session)
    return aside
  }

  failAside(sessionId: string, asideId: string, error: string): Aside {
    const session = this.get(sessionId)
    const aside = this.getAside(sessionId, asideId)
    aside.status = "failed"
    aside.error = error
    aside.resolvedAt = Date.now()
    this.emit(session)
    return aside
  }

  getAside(sessionId: string, asideId: string): Aside {
    const aside = this.get(sessionId).asides.find((a) => a.id === asideId)
    if (!aside) {
      throw new StateError(`Unknown aside ${asideId}`)
    }
    return aside
  }

  pendingAsides(sessionId: string): Aside[] {
    return this.get(sessionId).asides.filter((a) => a.status === "requested")
  }

  /* ---------- notes ---------- */

  addNote(sessionId: string, markdown: string): Note {
    const session = this.get(sessionId)
    const note: Note = { createdAt: Date.now(), id: newId("n"), markdown }
    session.notes.push(note)
    this.emit(session)
    return note
  }

  /* ---------- WS client messages ---------- */

  /** Apply a validated message coming from a browser. Throws StateError on invalid state. */
  apply(sessionId: string, msg: ClientMessage): void {
    switch (msg.type) {
      case "answer": {
        this.setAnswer(sessionId, msg.roundId, msg.questionId, msg.answer)
        break
      }
      case "clear_answer": {
        this.clearAnswer(sessionId, msg.roundId, msg.questionId)
        break
      }
      case "submit_round": {
        this.submitRound(sessionId, msg.roundId)
        break
      }
      case "request_aside": {
        this.requestAside(sessionId, msg.roundId, msg.questionId, msg.kind)
        break
      }
      default: {
        throw new StateError(`Unknown message ${JSON.stringify(msg)}`)
      }
    }
  }

  /* ---------- subscriptions ---------- */

  subscribe(sessionId: string, fn: Listener): () => void {
    const set = this.listeners.get(sessionId) ?? new Set<Listener>()
    this.listeners.set(sessionId, set)
    set.add(fn)
    return () => {
      set.delete(fn)
    }
  }

  private emit(session: Session): void {
    const set = this.listeners.get(session.id)
    if (!set) {
      return
    }
    for (const fn of set) {
      try {
        fn(session)
      } catch (error) {
        console.error("[bbq] listener error", error)
      }
    }
  }

  /**
   * Resolve as soon as `predicate(session)` returns a non-undefined value, or
   * with `undefined` after `timeoutMs`. Checks immediately first. This is the
   * only blocking primitive the MCP tools use, and it never outlives its timeout.
   */
  async waitFor<T>(
    sessionId: string,
    predicate: (s: Session) => T | undefined,
    timeoutMs: number
  ): Promise<T | undefined> {
    const now = predicate(this.get(sessionId))
    if (now !== undefined) {
      return now
    }
    const { promise, resolve } = Promise.withResolvers<T | undefined>()
    const cleanups: (() => void)[] = []
    let done = false
    const finish = (value?: T): void => {
      if (done) {
        return
      }
      done = true
      for (const cleanup of cleanups) {
        cleanup()
      }
      resolve(value)
    }
    cleanups.push(
      this.subscribe(sessionId, (session) => {
        const value = predicate(session)
        if (value !== undefined) {
          finish(value)
        }
      })
    )
    const timer = setTimeout(() => {
      finish()
    }, timeoutMs)
    cleanups.push(() => {
      clearTimeout(timer)
    })
    return await promise
  }
}
