import type { SessionSearch } from "./search"
/**
 * Pure derivations over the session snapshot and the URL search params.
 * Nothing here is stored: every "current X" is recomputed from these two
 * inputs, which is what makes the UI effect-free.
 */
import type {
  Aside,
  AsideKind,
  Note,
  Question,
  Round,
  Session,
} from "@shared/types"

import { ASIDE_KINDS } from "@shared/types"

export type TimelineItem =
  | { kind: "round"; at: number; id: string; round: Round }
  | { kind: "note"; at: number; id: string; note: Note }

export function timeline(session: Session): TimelineItem[] {
  const items: TimelineItem[] = [
    ...session.rounds.map((round): TimelineItem => ({
      at: round.createdAt,
      id: round.id,
      kind: "round",
      round,
    })),
    ...session.notes.map((note): TimelineItem => ({
      at: note.createdAt,
      id: note.id,
      kind: "note",
      note,
    })),
  ]
  return items.toSorted((a, b) => a.at - b.at)
}

export function openRound(session: Session): Round | undefined {
  return session.rounds.find((round) => round.status === "open")
}

export function firstUnanswered(round: Round): string | undefined {
  return round.questions.find((q) => round.answers[q.id] === undefined)?.id
}

/** The expanded question: the URL's choice if it belongs to the open round, else the first unanswered. */
export function activeQuestionId(
  session: Session,
  search: SessionSearch
): string | undefined {
  const round = openRound(session)
  if (!round) {
    return undefined
  }
  if (
    search.q !== undefined &&
    round.questions.some((q) => q.id === search.q)
  ) {
    return search.q
  }
  return firstUnanswered(round)
}

/**
 * The pick on the active question: the option the person has pointed at and
 * not yet confirmed. It is scoped to `?q=`, so moving the active question
 * forgets it, and it is checked against the question so a stale id from the
 * URL never lights a row up.
 * See docs/adr/0017-answering-takes-two-presses.md.
 */
export function activePick(
  session: Session,
  search: SessionSearch
): string | undefined {
  if (search.pick === undefined) {
    return undefined
  }
  const round = openRound(session)
  const questionId = activeQuestionId(session, search)
  const question = round?.questions.find((q) => q.id === questionId)
  if (question === undefined) {
    return undefined
  }
  return question.options.some((option) => option.id === search.pick)
    ? search.pick
    : undefined
}

export function newestAside(asides: Aside[]): Aside | undefined {
  let newest: Aside | undefined
  for (const aside of asides) {
    if (newest === undefined || aside.requestedAt > newest.requestedAt) {
      newest = aside
    }
  }
  return newest
}

/** The question shown in the side panel: explicit, else the newest aside the user has not dismissed. */
export function panelQuestionId(
  session: Session,
  search: SessionSearch
): string | undefined {
  if (search.panel !== undefined) {
    return search.panel
  }
  const newest = newestAside(session.asides)
  if (newest === undefined || newest.id === search.dismissed) {
    return undefined
  }
  return newest.questionId
}

export function asidesFor(session: Session, questionId: string): Aside[] {
  return session.asides.filter((aside) => aside.questionId === questionId)
}

/** Latest aside per kind for one question, in display order. */
export function asidesByKind(asides: Aside[]): Map<AsideKind, Aside> {
  const byKind = new Map<AsideKind, Aside>()
  for (const kind of ASIDE_KINDS) {
    const latest = newestAside(asides.filter((aside) => aside.kind === kind))
    if (latest) {
      byKind.set(kind, latest)
    }
  }
  return byKind
}

/** The panel tab: the URL's choice if that aside exists, else the newest aside's kind. */
export function panelTab(
  asides: Aside[],
  search: SessionSearch
): AsideKind | undefined {
  if (search.tab !== undefined && asides.some((a) => a.kind === search.tab)) {
    return search.tab
  }
  return newestAside(asides)?.kind
}

export interface QuestionLocation {
  question: Question
  round: Round
}

export function findQuestion(
  session: Session,
  questionId: string
): QuestionLocation | undefined {
  let found: QuestionLocation | undefined
  for (const round of session.rounds) {
    const question = round.questions.find((q) => q.id === questionId)
    if (question) {
      found = { question, round }
    }
  }
  return found
}

export function isPending(aside: Aside): boolean {
  return aside.status === "requested" || aside.status === "claimed"
}
