#!/usr/bin/env bun
/**
 * Plays Claude's role against the MCP server so the UI can be exercised without
 * Claude Code: opens a session, pushes demo rounds, answers asides with canned
 * content, and prints the answers when each round is submitted.
 *
 *   bun run demo
 */
import path from "node:path"

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { z } from "zod"

const CALL_TIMEOUT_MS = 600_000
const BROWSER_WAIT_MS = 60_000
const POLL_MS = 30_000
const THINKING_MS = 1200

const toolResultSchema = z.object({
  content: z.array(z.object({ text: z.string().optional() })),
  isError: z.boolean().optional(),
})

const env = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined
  )
)

const client = new Client({ name: "bbq-demo", version: "0.0.0" })
await client.connect(
  new StdioClientTransport({
    args: ["run", path.resolve(import.meta.dir, "../src/mcp.ts")],
    command: "bun",
    env,
    stderr: "inherit",
  })
)

async function call(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const raw = await client.callTool({ arguments: args, name }, undefined, {
    timeout: CALL_TIMEOUT_MS,
  })
  const result = toolResultSchema.parse(raw)
  const out = result.content.map((c) => c.text ?? "").join("\n")
  if (result.isError ?? false) {
    throw new Error(out)
  }
  return out
}

function field(out: string, key: string): string | undefined {
  const pattern = new RegExp(`^${key}: (?<value>.+)$`, "mu")
  return pattern.exec(out)?.groups?.value?.trim()
}

function requireField(out: string, key: string): string {
  const value = field(out, key)
  if (value === undefined) {
    throw new Error(`Missing "${key}" in tool output:\n${out}`)
  }
  return value
}

const ASIDE_ID = /asideId: "(?<id>[^"]+)"/u
const ASIDE_KIND = /pressed "(?<kind>[^"]+)"/u

const rounds: Record<string, unknown>[][] = [
  [
    {
      body: "When a card payment fails with a **soft decline** (issuer says 'try again later'), what should start the retry?\n\nThis decides where the retry logic lives and who owns its schedule.",
      options: [
        {
          description: "Simple, but latency up to 15 min and one hot spot",
          label: "Cron sweep every 15 min",
        },
        {
          description: "Precise timing, needs a job queue with delays",
          label: "Per-payment delayed job",
        },
        {
          description:
            "Zero polling, but depends on the provider supporting it",
          label: "Webhook from the PSP",
        },
      ],
      recommendation:
        "**Per-payment delayed job.** We already run BullMQ; delayed jobs are free, and we get exact backoff per payment.",
      recommendedOptionId: "b",
      title: "Retry trigger",
    },
    {
      body: "How many retries and with what spacing?",
      options: [
        { label: "3 tries: 1h, 6h, 24h" },
        { label: "5 tries: 15m, 1h, 4h, 12h, 48h" },
      ],
      recommendation:
        "3 tries at 1h / 6h / 24h. Issuer soft declines usually clear within a day; more tries mostly add fees.",
      recommendedOptionId: "a",
      title: "Backoff schedule",
    },
    {
      body: "Do we tell the customer about each retry, only about the final failure, or nothing until success?",
      recommendation:
        "Only on final failure, with a 'update card' link. Intermediate mails train people to ignore us.",
      title: "Customer notification",
    },
  ],
  [
    {
      body: "Retries must never double-charge. Where do we derive the idempotency key?",
      options: [
        { label: "payment.id + attempt number" },
        { label: "payment.id only (PSP dedupes)" },
      ],
      recommendation:
        "payment.id + attempt number: each attempt is a distinct request, but a crashed attempt can be safely re-sent.",
      recommendedOptionId: "a",
      title: "Idempotency key",
    },
  ],
]

const cannedAside: Record<
  string,
  { format: "markdown" | "html"; content: string }
> = {
  eli5: {
    content: `<div style="display:grid;gap:14px;font-size:17px">
<div style="font-size:48px;text-align:center">🏪 💳 ❌ → 🕐 → 💳 ✅</div>
<p>You try to pay. The shop says: <b>not now, come back later</b>.</p>
<p>Who remembers to come back?</p>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center">
<div style="background:#1c2029;border-radius:10px;padding:10px"><div style="font-size:40px">⏰</div>A big alarm clock rings for <i>everyone</i> every 15 minutes.</div>
<div style="background:#f59e0b22;border:1px solid #f59e0b;border-radius:10px;padding:10px"><div style="font-size:40px">📝</div>You write <i>your own</i> sticky note: “try again at 3pm”. ★</div>
<div style="background:#1c2029;border-radius:10px;padding:10px"><div style="font-size:40px">📞</div>The shop <i>calls you</i> when it's ready.</div>
</div>
<p><b>So we pick</b> the sticky note. We already have a pile of them.</p></div>`,
    format: "html",
  },
  "show-me": {
    content:
      "Three ways to start the second attempt, and what each one costs.\n\n" +
      "```mermaid\n" +
      "flowchart LR\n" +
      '  F["Card payment fails<br/>retryable"]\n' +
      '  A["Cron sweep<br/>≤15 min · hot spot"]\n' +
      '  B["Delayed job ★<br/>exact · BullMQ, already here"]\n' +
      '  C["PSP webhook<br/>exact · needs PSP support"]\n' +
      '  R["Retry the payment"]\n' +
      "  F --> A --> R\n" +
      "  F --> B --> R\n" +
      "  F --> C --> R\n" +
      "```\n\n" +
      "★ the recommendation: one timer per payment, on a queue we already run.",
    format: "markdown",
  },
  "wait-what": {
    content:
      "**Context.** Some card payments fail in a way that is not final. The bank says: try again later.\n\n" +
      "**The question.** Something must start that second try. We must choose what.\n\n" +
      "- **Cron sweep**: a timer runs every 15 minutes and looks for payments to retry.\n" +
      "- **Delayed job**: when a payment fails, we schedule one job for that payment.\n" +
      "- **PSP webhook**: the payment provider calls us when it is time.\n\n" +
      "**Recommendation.** Delayed job. We have the queue. Each payment gets its own timer.",
    format: "markdown",
  },
}

async function answerAside(sessionId: string, out: string): Promise<void> {
  const asideId = ASIDE_ID.exec(out)?.groups?.id
  const kind = ASIDE_KIND.exec(out)?.groups?.kind
  if (asideId === undefined || kind === undefined) {
    throw new Error(`Could not parse aside request:\n${out}`)
  }
  const canned = cannedAside[kind]
  if (!canned) {
    throw new Error(`No canned aside for kind ${kind}`)
  }
  console.log(`aside ${kind} → ${asideId}`)
  // Pretend to think.
  await Bun.sleep(THINKING_MS)
  await call("post_aside", { asideId, sessionId, ...canned })
}

/** Poll until the round is answered or the session closes. Recursion keeps each await out of a loop. */
async function pollRound(sessionId: string, roundId: string): Promise<string> {
  const out = await call("wait_for_answers", {
    roundId,
    sessionId,
    timeoutMs: POLL_MS,
  })
  // `pending`/`answered`/`closed` come back as `status:`; an aside request
  // leads with `outcome:` because it is an instruction, not a report.
  const status = field(out, "status") ?? field(out, "outcome")
  if (status === "pending") {
    console.log(".")
    return await pollRound(sessionId, roundId)
  }
  if (status === "aside_requested") {
    await answerAside(sessionId, out)
    return await pollRound(sessionId, roundId)
  }
  return out
}

async function runRounds(sessionId: string, index: number): Promise<void> {
  const questions = rounds[index]
  if (!questions) {
    return
  }
  const asked = await call("ask_round", {
    intro:
      questions.length > 1
        ? "Round from the demo driver. Answer in order; change anything before sending."
        : undefined,
    questions,
    sessionId,
  })
  const roundId = requireField(asked, "roundId")
  console.log(`\n--- round ${roundId} pushed`)
  const out = await pollRound(sessionId, roundId)
  console.log(out)
  if ((field(out, "status") ?? field(out, "outcome")) === "closed") {
    process.exit(0)
  }
  await call("post_note", {
    markdown: "Got it. Settling those and computing the next frontier…",
    sessionId,
  })
  await runRounds(sessionId, index + 1)
}

const opened = await call("open_session", {
  title: "Demo: payment retry design",
  waitForBrowserMs: BROWSER_WAIT_MS,
})
console.log(opened)
const sessionId = requireField(opened, "sessionId")

await runRounds(sessionId, 0)

await call("post_note", {
  markdown:
    "**Shared understanding reached (demo).** Delayed BullMQ job per payment, 3 retries at 1h/6h/24h, notify only on final failure, idempotency key = payment.id + attempt.",
  sessionId,
})
await call("close_session", { sessionId })
await client.close()
process.exit(0)
