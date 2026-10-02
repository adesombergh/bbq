#!/usr/bin/env bun
/**
 * bbq MCP server (stdio).
 *
 * stdout is the JSON-RPC channel: every log goes to console.error.
 * The hub (HTTP + WS) starts immediately on 127.0.0.1:0 and serves the
 * prebuilt UI from ui/dist. This process never invokes Vite.
 *
 * Polling contract: no tool blocks longer than its `timeoutMs` (capped by
 * MAX_WAIT_MS). `wait_for_answers` returns `pending` on timeout and Claude
 * simply calls it again. Rounds can therefore sit open for hours. The default
 * poll is long on purpose: every event worth waking for — an answer, an aside,
 * a close, the tab going away — resolves the wait early, so a short poll would
 * only buy wakeups that find nothing (ADR 0002).
 */
import type { Aside, Round, Session } from "./types.ts"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"

import path from "node:path"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

import pkg from "../package.json" with { type: "json" }
import { openBrowser } from "./browser.ts"
import { startHub } from "./hub.ts"
import { StateError } from "./state-error.ts"
import { Store } from "./state.ts"
import {
  answeredReport,
  asideInstruction,
  closedReport,
  disconnectedReport,
  openedNextStep,
  pendingReport,
} from "./tool-prose.ts"
import { ASIDE_KINDS, SESSION_KINDS } from "./types.ts"

function log(...args: unknown[]): void {
  console.error("[bbq]", ...args)
}

/** Default poll length. Override with BBQ_WAIT_MS. */
const DEFAULT_WAIT_MS = Number(process.env.BBQ_WAIT_MS ?? 240_000)
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

type Outcome =
  | { kind: "answered"; round: Round }
  | { kind: "aside"; aside: Aside }
  | { kind: "closed" }
  | { kind: "disconnected" }

/**
 * What ends a wait. `hadTab` is the tab count when the wait started: losing the
 * last tab is an outcome, but a session that was already tabless is not, or a
 * wait on a closed tab would return the instant it was called and Claude would
 * spin. It waits out its timeout instead and says so in the pending report.
 */
function outcomeFor(
  session: Session,
  roundId: string,
  hadTab: boolean
): Outcome | undefined {
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
  if (hadTab && session.tabs === 0) {
    return { kind: "disconnected" }
  }
  return undefined
}

/* ---------- server ---------- */

const server = new McpServer({ name: pkg.name, version: pkg.version })

server.registerTool(
  "open_session",
  {
    description:
      "Start a bbq session and open the browser UI. Blocks until a tab connects (at most waitForBrowserMs) and " +
      "returns the sessionId and url. Once per session, then ask_round / wait_for_answers.",
    inputSchema: {
      kind: z
        .enum(SESSION_KINDS)
        .optional()
        .describe(
          "'grilling' (default) runs the grilling skill in the browser; 'offload' only carries the questions of " +
            "the skill you are already running, which owns the ending."
        ),
      shortTitle: z
        .string()
        .min(1)
        .optional()
        .describe(
          "Two to four words for the browser tab. Defaults to `title`."
        ),
      title: z
        .string()
        .min(1)
        .describe(
          "What is being grilled, or what the offloading skill works on"
        ),
      waitForBrowserMs: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(`Default ${DEFAULT_BROWSER_WAIT_MS}, max ${MAX_WAIT_MS}`),
    },
    title: "Open a bbq session in the browser",
  },
  guard(async ({ title, shortTitle, kind, waitForBrowserMs }) => {
    const session = store.createSession(title, shortTitle, kind)
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
    lines.push("", openedNextStep(session.kind))
    return text(lines.join("\n"))
  })
)

const questionSchema = z.object({
  body: z.string().min(1).describe("The question, markdown"),
  id: z.string().optional().describe("Stable id; defaults to r<round>q<n>"),
  options: z
    .array(
      z.object({
        description: z.string().optional().describe("One-line trade-off"),
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
    .describe("The option the recommendation picks, if it is one of them"),
  title: z.string().min(1).describe("Short title, e.g. 'Transport'"),
})

server.registerTool(
  "ask_round",
  {
    description:
      "Publish one round of questions: a grilling's frontier, or the next question of an offload. Returns the " +
      "roundId. Only one round open at a time; follow with wait_for_answers.",
    inputSchema: {
      intro: z
        .string()
        .optional()
        .describe(
          "Short intro for the round (markdown), e.g. what the last answers settled"
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
      "Block until something happens on the round, at most timeoutMs. Returns `answered` (answers included), " +
      "`aside_requested` (produce the aside, post_aside it, call again), `disconnected` (tab closed), `pending` " +
      "(timeout; call again) or `closed`. Never blocks past timeoutMs, so it is safe to loop on.",
    inputSchema: {
      roundId: z.string(),
      sessionId: z.string(),
      timeoutMs: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(`Default ${DEFAULT_WAIT_MS}, cap ${MAX_WAIT_MS}`),
    },
    title: "Wait for the user (poll)",
  },
  guard(async ({ sessionId, roundId, timeoutMs }) => {
    // Validate the round before waiting on it.
    store.getRound(sessionId, roundId)
    const hadTab = store.get(sessionId).tabs > 0
    const outcome = await store.waitFor(
      sessionId,
      (s) => outcomeFor(s, roundId, hadTab),
      clampWait(timeoutMs, DEFAULT_WAIT_MS)
    )

    const session = store.get(sessionId)
    const url = hub.urlFor(sessionId)
    if (!outcome) {
      return text(
        pendingReport(session, store.getRound(sessionId, roundId), url)
      )
    }
    switch (outcome.kind) {
      case "closed": {
        return text(closedReport(session.kind))
      }
      case "disconnected": {
        return text(disconnectedReport(store.getRound(sessionId, roundId), url))
      }
      case "aside": {
        store.claimAside(sessionId, outcome.aside.id)
        return text(asideInstruction(session, outcome.aside))
      }
      case "answered": {
        return text(answeredReport(outcome.round, session.kind))
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
      "Send the content produced for an aside into the browser's contextual panel. 'markdown' renders as rich " +
      "text and draws a ```mermaid block as a diagram; 'html' renders in a sandboxed frame (inline SVG/CSS, no " +
      "scripts). Pick the format per aside.",
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
      "Show a free-form markdown message in the browser chat, between rounds: what the last answers settled, the " +
      "shared understanding, or a status like 'looking something up'.",
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
      "Mark the session finished. The browser shows a closed banner; the tab can stay open.",
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
