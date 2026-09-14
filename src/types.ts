/**
 * Shared types between the MCP server, the state module, the WS hub and the UI.
 * The UI imports this file directly (ui/src -> ../../src/types.ts), so keep it
 * free of runtime imports.
 */

export const ASIDE_KINDS = ["wait-what", "show-me", "eli5"] as const

export type AsideKind = (typeof ASIDE_KINDS)[number]

export interface Option {
  id: string
  label: string
  /** Optional longer explanation of the option (markdown). */
  description?: string
}

export interface Question {
  id: string
  /** Short title, e.g. "Transport". */
  title: string
  /** Full question body, markdown. */
  body: string
  /** Closed questions carry options; open questions have none. */
  options: Option[]
  /** Claude's recommended answer, markdown. Always present (grilling format). */
  recommendation: string
  /** If the recommendation maps to one of the options, its id. */
  recommendedOptionId?: string
}

export type AnswerKind = "option" | "text" | "recommended"

export interface Answer {
  kind: AnswerKind
  /** Set when kind === "option" (or "recommended" resolving to an option). */
  optionId?: string
  /** Human-readable answer text. Always set. */
  text: string
  answeredAt: number
}

export type RoundStatus = "open" | "submitted"

export interface Round {
  id: string
  /** 1-based round number within the session. */
  index: number
  /** Optional intro shown above the questions (markdown). */
  intro?: string
  questions: Question[]
  answers: Record<string, Answer>
  status: RoundStatus
  createdAt: number
  submittedAt?: number
}

export type AsideStatus = "requested" | "claimed" | "resolved" | "failed"

export interface Aside {
  id: string
  roundId: string
  questionId: string
  kind: AsideKind
  status: AsideStatus
  /** Rendered content once resolved. */
  format?: "markdown" | "html"
  content?: string
  error?: string
  requestedAt: number
  resolvedAt?: number
}

/** A free-form message from Claude shown in the chat column (summary, status...). */
export interface Note {
  id: string
  markdown: string
  createdAt: number
}

export type SessionStatus = "open" | "closed"

/**
 * What a session is for. A grilling runs the grilling skill in the browser and
 * ends in its last round; an offload only carries the questions of whatever
 * skill is running, which owns the ending (ADR 0021).
 */
export const SESSION_KINDS = ["grilling", "offload"] as const

export type SessionKind = (typeof SESSION_KINDS)[number]

export interface Session {
  id: string
  title: string
  /** Terse label for the browser tab, capped in length. Defaults to `title`. */
  shortTitle: string
  kind: SessionKind
  status: SessionStatus
  createdAt: number
  closedAt?: number
  rounds: Round[]
  asides: Aside[]
  notes: Note[]
  /** Number of browser tabs currently connected. */
  tabs: number
}

/* ---------- WebSocket protocol ---------- */

export type ServerMessage =
  | { type: "state"; session: Session }
  | { type: "error"; message: string }

export type ClientMessage =
  | {
      type: "answer"
      roundId: string
      questionId: string
      answer: Omit<Answer, "answeredAt">
    }
  | { type: "clear_answer"; roundId: string; questionId: string }
  | { type: "submit_round"; roundId: string }
  | {
      type: "request_aside"
      roundId: string
      questionId: string
      kind: AsideKind
    }
