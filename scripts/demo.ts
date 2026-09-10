#!/usr/bin/env bun
/**
 * Plays Claude's role against the MCP server so the UI can be exercised without
 * Claude Code: opens a session, pushes a demo round, answers asides with canned
 * content, and prints the answers when the round is submitted.
 *
 *   bun run demo
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";

const client = new Client({ name: "grill-ui-demo", version: "0.0.0" });
await client.connect(
  new StdioClientTransport({
    command: "bun",
    args: ["run", resolve(import.meta.dir, "../src/mcp.ts")],
    stderr: "inherit",
    env: { ...process.env },
  }),
);

async function call(name: string, args: Record<string, unknown>): Promise<string> {
  const res = (await client.callTool({ name, arguments: args }, undefined, { timeout: 600_000 })) as {
    content: { type: string; text: string }[];
    isError?: boolean;
  };
  const text = res.content.map((c) => c.text).join("\n");
  if (res.isError) throw new Error(text);
  return text;
}
const field = (out: string, key: string) => out.match(new RegExp(`^${key}: (.+)$`, "m"))?.[1]?.trim();

const opened = await call("open_session", { title: "Demo: payment retry design", waitForBrowserMs: 60_000 });
console.log(opened);
const sessionId = field(opened, "sessionId")!;

const rounds: Record<string, unknown>[][] = [
  [
    {
      title: "Retry trigger",
      body: "When a card payment fails with a **soft decline** (issuer says 'try again later'), what should start the retry?\n\nThis decides where the retry logic lives and who owns its schedule.",
      options: [
        { label: "Cron sweep every 15 min", description: "Simple, but latency up to 15 min and one hot spot" },
        { label: "Per-payment delayed job", description: "Precise timing, needs a job queue with delays" },
        { label: "Webhook from the PSP", description: "Zero polling, but depends on the provider supporting it" },
      ],
      recommendation: "**Per-payment delayed job.** We already run BullMQ; delayed jobs are free, and we get exact backoff per payment.",
      recommendedOptionId: "b",
    },
    {
      title: "Backoff schedule",
      body: "How many retries and with what spacing?",
      options: [
        { label: "3 tries: 1h, 6h, 24h" },
        { label: "5 tries: 15m, 1h, 4h, 12h, 48h" },
      ],
      recommendation: "3 tries at 1h / 6h / 24h. Issuer soft declines usually clear within a day; more tries mostly add fees.",
      recommendedOptionId: "a",
    },
    {
      title: "Customer notification",
      body: "Do we tell the customer about each retry, only about the final failure, or nothing until success?",
      recommendation: "Only on final failure, with a 'update card' link. Intermediate mails train people to ignore us.",
    },
  ],
  [
    {
      title: "Idempotency key",
      body: "Retries must never double-charge. Where do we derive the idempotency key?",
      options: [
        { label: "payment.id + attempt number" },
        { label: "payment.id only (PSP dedupes)" },
      ],
      recommendation: "payment.id + attempt number: each attempt is a distinct request, but a crashed attempt can be safely re-sent.",
      recommendedOptionId: "a",
    },
  ],
];

const cannedAside: Record<string, { format: "markdown" | "html"; content: string }> = {
  "wait-what": {
    format: "markdown",
    content:
      "**Context.** Some card payments fail in a way that is not final. The bank says: try again later.\n\n" +
      "**The question.** Something must start that second try. We must choose what.\n\n" +
      "- **Cron sweep**: a timer runs every 15 minutes and looks for payments to retry.\n" +
      "- **Delayed job**: when a payment fails, we schedule one job for that payment.\n" +
      "- **PSP webhook**: the payment provider calls us when it is time.\n\n" +
      "**Recommendation.** Delayed job. We have the queue. Each payment gets its own timer.",
  },
  "show-me": {
    format: "html",
    content: `<svg viewBox="0 0 640 260" width="100%" style="max-width:640px" font-family="system-ui" font-size="14">
  <rect x="10" y="20" width="180" height="60" rx="8" fill="#1c2029" stroke="#2a2f3a"/><text x="100" y="45" text-anchor="middle" fill="#e6e8ee">Cron sweep</text><text x="100" y="65" text-anchor="middle" fill="#8b93a7">scan all every 15m</text>
  <rect x="230" y="20" width="180" height="60" rx="8" fill="#f59e0b22" stroke="#f59e0b"/><text x="320" y="45" text-anchor="middle" fill="#e6e8ee">Delayed job ★</text><text x="320" y="65" text-anchor="middle" fill="#8b93a7">1 job per payment</text>
  <rect x="450" y="20" width="180" height="60" rx="8" fill="#1c2029" stroke="#2a2f3a"/><text x="540" y="45" text-anchor="middle" fill="#e6e8ee">PSP webhook</text><text x="540" y="65" text-anchor="middle" fill="#8b93a7">provider calls us</text>
  <g fill="#8b93a7"><text x="100" y="130" text-anchor="middle">latency: ≤15 min</text><text x="320" y="130" text-anchor="middle" fill="#34d399">latency: exact</text><text x="540" y="130" text-anchor="middle">latency: exact</text>
  <text x="100" y="160" text-anchor="middle" fill="#34d399">deps: none</text><text x="320" y="160" text-anchor="middle" fill="#34d399">deps: BullMQ (have it)</text><text x="540" y="160" text-anchor="middle" fill="#f87171">deps: PSP support</text>
  <text x="100" y="190" text-anchor="middle" fill="#f87171">hot spot: yes</text><text x="320" y="190" text-anchor="middle" fill="#34d399">hot spot: no</text><text x="540" y="190" text-anchor="middle" fill="#34d399">hot spot: no</text></g>
</svg>`,
  },
  eli5: {
    format: "html",
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
  },
};

for (const questions of rounds) {
  const asked = await call("ask_round", {
    sessionId,
    intro: questions.length > 1 ? "Round from the demo driver. Answer in order; change anything before sending." : undefined,
    questions,
  });
  const roundId = field(asked, "roundId")!;
  console.log(`\n--- round ${roundId} pushed`);

  for (;;) {
    const out = await call("wait_for_answers", { sessionId, roundId, timeoutMs: 30_000 });
    const status = field(out, "status");
    if (status === "pending") {
      console.log(".");
      continue;
    }
    if (status === "aside_requested") {
      const asideId = out.match(/asideId: "([^"]+)"/)?.[1]!;
      const kind = out.match(/pressed "([^"]+)"/)?.[1] as keyof typeof cannedAside;
      console.log(`aside ${kind} → ${asideId}`);
      await new Promise((r) => setTimeout(r, 1200)); // pretend to think
      await call("post_aside", { sessionId, asideId, ...cannedAside[kind]! });
      continue;
    }
    console.log(out);
    if (status === "closed") process.exit(0);
    break; // answered
  }
  await call("post_note", { sessionId, markdown: "Got it. Settling those and computing the next frontier…" });
}

await call("post_note", {
  sessionId,
  markdown: "**Shared understanding reached (demo).** Delayed BullMQ job per payment, 3 retries at 1h/6h/24h, notify only on final failure, idempotency key = payment.id + attempt.",
});
await call("close_session", { sessionId });
await client.close();
process.exit(0);
