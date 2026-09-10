#!/usr/bin/env bun
/**
 * grill-ui MCP server (stdio).
 *
 * stdout is the JSON-RPC channel: every log goes to console.error.
 * The hub (HTTP + WS) starts immediately on 127.0.0.1:0 and serves the
 * prebuilt UI from ui/dist. This process never invokes Vite.
 *
 * Polling contract: no tool blocks longer than its `timeoutMs` (capped by
 * MAX_WAIT_MS). `wait_for_answers` returns `pending` on timeout and Claude
 * simply calls it again. Rounds can therefore sit open for hours.
 */
import type { Answer, Aside, Round, Session } from "./types.ts"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"

import path from "node:path"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

import { ASIDE_BRIEFS, briefStep } from "./aside-brief.ts"
import { openBrowser } from "./browser.ts"
import { startHub } from "./hub.ts"
import { answeredCount } from "./round-rules.ts"
import { StateError } from "./state-error.ts"
import { Store } from "./state.ts"
import { ASIDE_KINDS } from "./types.ts"

function log(...args: unknown[]): void {
  console.error("[grill-ui]", ...args)
}

/** Default poll length. Override with GRILL_UI_WAIT_MS. */
const DEFAULT_WAIT_MS = Number(process.env.GRILL_UI_WAIT_MS ?? 55_000)
/** Hard cap: stays under Claude Code's 5 min idle cutoff with margin. */
const MAX_WAIT_MS = 280_000
const MIN_WAIT_MS = 1000
const DEFAULT_BROWSER_WAIT_MS = 30_000

const store = new Store()
const token = crypto.randomUUID().replaceAll("-", "")
const distDir = path.resolve(import.meta.dir, "../ui/dist")
const hub = startHub({ distDir, store, token })

/* ---------- helpers ---------- */

function text(s: string): CallToolResult {
  return { content: [{ text: s, type: "text" }] }
}

function fail(s: string): CallToolResult {
  return { content: [{ text: s, type: "text" }], isError: true }
}

function clampWait(ms: number | undefined, fallback: number): number {
  const value = ms ?? fallback
  return Math.max(MIN_WAIT_MS, Math.min(MAX_WAIT_MS, value))
}

function guard<Args>(
  fn: (args: Args) => Promise<CallToolResult> | CallToolResult
): (args: Args) => Promise<CallToolResult> {
  return async (args: Args): Promise<CallToolResult> => {
    try {
      return await fn(args)
    } catch (error) {
      if (error instanceof StateError) {
        return fail(error.message)
      }
      log("tool error", error)
      const reason = error instanceof Error ? error.message : String(error)
      return fail(`Internal error: ${reason}`)
    }
  }
}

function questionSummary(round: Round, questionId: string): string {
  const question = round.questions.find((q) => q.id === questionId)
  if (!question) {
    throw new StateError(`Unknown question ${questionId}`)
  }
  const options =
    question.options.length > 0
      ? `\nOptions:\n${question.options
          .map((o) => {
            const detail =
              o.description === undefined ? "" : ` — ${o.description}`
            return `  - (${o.id}) ${o.label}${detail}`
          })
          .join("\n")}`
      : "\n(open question, no fixed options)"
  const position = round.questions.indexOf(question) + 1
  return `Q${position} [${question.id}] — ${question.title}\n${question.body}${options}\nRecommendation: ${question.recommendation}`
}

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

const FORMAT_RULE =
  'Pick the format that matches what you produced: "markdown" for prose, code, tables or a ```mermaid diagram; ' +
  '"html" for a fragment with inline CSS and no scripts or external resources, which renders in a sandboxed frame. ' +
  "Deliver it through post_aside — never write a file, never open one."

function asideInstruction(session: Session, aside: Aside): string {
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

type Outcome =
  | { kind: "answered"; round: Round }
  | { kind: "aside"; aside: Aside }
  | { kind: "closed" }

function outcomeFor(session: Session, roundId: string): Outcome | undefined {
  if (session.status === "closed") {
    return { kind: "closed" }
  }
  const aside = session.asides.find((a) => a.status === "requested")
  if (aside) {
    return { aside, kind: "aside" }
  }
  const round = session.rounds.find((r) => r.id === roundId)
  if (round?.status === "submitted") {
    return { kind: "answered", round }
  }
  return undefined
}

function pendingReport(session: Session, round: Round): string {
  const hint =
    session.tabs === 0
      ? `No browser is connected. The user may have closed the tab; the URL is ${hub.urlFor(session.id)}.`
      : "The user is still working. Call wait_for_answers again."
  return [
    "outcome: pending",
    `progress: ${answeredCount(round)}/${round.questions.length} answered (not submitted yet)`,
    `tabs: ${session.tabs}`,
    hint,
  ].join("\n")
}

function answeredReport(round: Round): string {
  return [
    "outcome: answered",
    `round: ${round.index}`,
    "",
    formatAnswers(round),
    "",
    "Next: recompute the frontier. If it is non-empty, ask_round again. If it is empty, post_note a summary of the " +
      "shared understanding and ask the user to confirm it (as a final one-question round), then close_session.",
  ].join("\n")
}

/* ---------- server ---------- */

const server = new McpServer({ name: "grill-ui", version: "0.1.0" })

server.registerTool(
  "open_session",
  {
    description:
      "Start a grill-ui session and open the browser UI. Blocks until a browser tab connects (at most waitForBrowserMs) " +
      "and returns the sessionId and URL. Call once per grilling session, then use ask_round / wait_for_answers.",
    inputSchema: {
      shortTitle: z
        .string()
        .min(1)
        .optional()
        .describe(
          "Two to four words for the browser tab, e.g. 'Payment retries'. Defaults to `title`; truncated if long."
        ),
      title: z
        .string()
        .min(1)
        .describe("What is being grilled, e.g. 'Payment retry design'"),
      waitForBrowserMs: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          `How long to wait for a browser to connect (default ${DEFAULT_BROWSER_WAIT_MS}, max ${MAX_WAIT_MS})`
        ),
    },
    title: "Open a grilling session in the browser",
  },
  guard(async ({ title, shortTitle, waitForBrowserMs }) => {
    const session = store.createSession(title, shortTitle)
    const url = hub.urlFor(session.id)
    const opened = openBrowser(url)
    log(`session ${session.id} at ${url}`)
    const connected = await store.waitFor(
      session.id,
      (s) => (s.tabs > 0 ? true : undefined),
      clampWait(waitForBrowserMs, DEFAULT_BROWSER_WAIT_MS)
    )
    const lines = [
      `sessionId: ${session.id}`,
      `url: ${url}`,
      `browserConnected: ${connected === true}`,
    ]
    if (connected !== true) {
      lines.push(
        opened
          ? "No browser connected yet. Tell the user to open the URL above, then continue; the page connects on load."
          : "Could not launch a browser automatically. Give the user the URL above to open manually."
      )
    }
    lines.push(
      "",
      "Next: run the grilling skill as usual, but instead of printing a round, call ask_round with the frontier " +
        "(numbered questions with title, body, options if any, and your recommendation), then loop on wait_for_answers " +
        "until it returns outcome: answered. Keep terminal output minimal; the browser is the conversation surface."
    )
    return text(lines.join("\n"))
  })
)

const questionSchema = z.object({
  body: z
    .string()
    .min(1)
    .describe("The question, markdown. Can be several paragraphs."),
  id: z.string().optional().describe("Stable id; defaults to r<round>q<n>"),
  options: z
    .array(
      z.object({
        description: z
          .string()
          .optional()
          .describe("One-line explanation / trade-off (markdown)"),
        id: z.string().optional().describe("Defaults to a, b, c…"),
        label: z.string().min(1),
      })
    )
    .optional()
    .describe("Omit for an open question"),
  recommendation: z
    .string()
    .min(1)
    .describe("Your recommended answer, markdown (the ➡️ line)"),
  recommendedOptionId: z
    .string()
    .optional()
    .describe(
      "If the recommendation is one of the options, its id, so 'Go with recommended' can select it"
    ),
  title: z.string().min(1).describe("Short title, e.g. 'Transport'"),
})

server.registerTool(
  "ask_round",
  {
    description:
      "Publish one grilling round (the current frontier). Returns immediately with the roundId. Only one round can be " +
      "open at a time. Follow with wait_for_answers.",
    inputSchema: {
      intro: z
        .string()
        .optional()
        .describe(
          "Optional short intro for the round (markdown), e.g. what the last answers settled"
        ),
      questions: z.array(questionSchema).min(1),
      sessionId: z.string(),
    },
    title: "Push a round of questions to the browser",
  },
  guard(({ sessionId, intro, questions }) => {
    const round = store.addRound(sessionId, questions, intro)
    return text(
      [
        `roundId: ${round.id}`,
        `round: ${round.index}`,
        `questionIds: ${round.questions.map((q) => q.id).join(", ")}`,
        `Next: call wait_for_answers({ sessionId: "${sessionId}", roundId: "${round.id}" }) and keep calling it while it returns pending.`,
      ].join("\n")
    )
  })
)

server.registerTool(
  "wait_for_answers",
  {
    description:
      "Block until something happens on the round, for at most timeoutMs. Returns one of: " +
      "`answered` (round submitted; answers included), `aside_requested` (user pressed Wait what / Show me / ELI5 on a " +
      "question: produce the aside, post_aside it, then call this again), `pending` (timeout; call again), " +
      "`closed` (session closed). Never blocks past timeoutMs, so it is safe to call in a loop.",
    inputSchema: {
      roundId: z.string(),
      sessionId: z.string(),
      timeoutMs: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          `Max block time (default ${DEFAULT_WAIT_MS}, cap ${MAX_WAIT_MS})`
        ),
    },
    title: "Wait for the user (poll)",
  },
  guard(async ({ sessionId, roundId, timeoutMs }) => {
    // Validate the round before waiting on it.
    store.getRound(sessionId, roundId)
    const outcome = await store.waitFor(
      sessionId,
      (s) => outcomeFor(s, roundId),
      clampWait(timeoutMs, DEFAULT_WAIT_MS)
    )

    const session = store.get(sessionId)
    if (!outcome) {
      return text(pendingReport(session, store.getRound(sessionId, roundId)))
    }
    switch (outcome.kind) {
      case "closed": {
        return text("outcome: closed\nThe session was closed.")
      }
      case "aside": {
        store.claimAside(sessionId, outcome.aside.id)
        return text(asideInstruction(session, outcome.aside))
      }
      case "answered": {
        return text(answeredReport(outcome.round))
      }
      default: {
        return fail("Unknown outcome")
      }
    }
  })
)

server.registerTool(
  "post_aside",
  {
    description:
      "Send the content produced for an aside request into the contextual panel of the browser. " +
      "format 'markdown' renders as rich text, and a ```mermaid block in it is drawn as a diagram; " +
      "'html' renders in a sandboxed frame (inline SVG/CSS ok, no scripts). The format is yours to pick per aside.",
    inputSchema: {
      asideId: z.string(),
      content: z.string().min(1),
      format: z.enum(["markdown", "html"]),
      sessionId: z.string(),
    },
    title: "Deliver a Wait-what / Show-me / ELI5 result",
  },
  guard(({ sessionId, asideId, format, content }) => {
    const aside = store.resolveAside(sessionId, asideId, format, content)
    const openRound = store
      .get(sessionId)
      .rounds.find((r) => r.status === "open")
    const next = openRound
      ? ` Next: wait_for_answers({ sessionId: "${sessionId}", roundId: "${openRound.id}" }).`
      : ""
    return text(`Posted ${aside.kind} for ${aside.questionId}.${next}`)
  })
)

server.registerTool(
  "post_note",
  {
    description:
      "Show a free-form markdown message in the browser chat (between rounds): what the last answers settled, a summary " +
      "of the shared understanding, or a status like 'looking something up'.",
    inputSchema: { markdown: z.string().min(1), sessionId: z.string() },
    title: "Post a message in the chat column",
  },
  guard(({ sessionId, markdown }) => {
    const note = store.addNote(sessionId, markdown)
    return text(`Posted note ${note.id}.`)
  })
)

server.registerTool(
  "close_session",
  {
    description:
      "Mark the session finished. The browser shows a closed banner; the tab can stay open for reference.",
    inputSchema: { sessionId: z.string() },
    title: "Close the session",
  },
  guard(({ sessionId }) => {
    store.closeSession(sessionId)
    return text(`Session ${sessionId} closed.`)
  })
)

/* ---------- lifecycle ---------- */

const transport = new StdioServerTransport()
await server.connect(transport)
log(`ready (pid ${process.pid}), aside kinds: ${ASIDE_KINDS.join(", ")}`)

function shutdown(reason: string): void {
  log(`shutting down (${reason})`)
  hub.stop()
  process.exit(0)
}
process.stdin.on("close", () => {
  shutdown("stdin closed")
})
process.on("SIGINT", () => {
  shutdown("SIGINT")
})
process.on("SIGTERM", () => {
  shutdown("SIGTERM")
})
