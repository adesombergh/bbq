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
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolve } from "node:path";
import { z } from "zod";
import { openBrowser } from "./browser.ts";
import { startHub } from "./hub.ts";
import { StateError, Store } from "./state.ts";
import { ASIDE_KINDS, type Aside, type Round, type Session } from "./types.ts";

const log = (...a: unknown[]) => console.error("[grill-ui]", ...a);

/** Default poll length. Override with GRILL_UI_WAIT_MS. */
const DEFAULT_WAIT_MS = Number(process.env.GRILL_UI_WAIT_MS ?? 55_000);
/** Hard cap: stays under Claude Code's 5 min idle cutoff with margin. */
const MAX_WAIT_MS = 280_000;
const DEFAULT_BROWSER_WAIT_MS = 30_000;

const store = new Store();
const token = crypto.randomUUID().replace(/-/g, "");
const distDir = resolve(import.meta.dir, "../ui/dist");
const hub = startHub({ store, token, distDir });

/* ---------- helpers ---------- */

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const text = (s: string): ToolResult => ({ content: [{ type: "text", text: s }] });
const fail = (s: string): ToolResult => ({ content: [{ type: "text", text: s }], isError: true });

function clampWait(ms: number | undefined, fallback: number): number {
  const v = ms ?? fallback;
  return Math.max(1_000, Math.min(MAX_WAIT_MS, v));
}

function guard<T extends unknown[]>(fn: (...args: T) => Promise<ToolResult> | ToolResult) {
  return async (...args: T): Promise<ToolResult> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof StateError) return fail(err.message);
      log("tool error", err);
      return fail(`Internal error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
}

function questionSummary(round: Round, questionId: string): string {
  const q = round.questions.find((q) => q.id === questionId)!;
  const opts = q.options.length
    ? "\nOptions:\n" +
      q.options
        .map((o) => `  - (${o.id}) ${o.label}${o.description ? ` — ${o.description}` : ""}`)
        .join("\n")
    : "\n(open question, no fixed options)";
  return `Q${round.questions.indexOf(q) + 1} [${q.id}] — ${q.title}\n${q.body}${opts}\nRecommendation: ${q.recommendation}`;
}

function formatAnswers(round: Round): string {
  return round.questions
    .map((q, i) => {
      const a = round.answers[q.id];
      if (!a) return `Q${i + 1} ${q.title}: (unanswered)`;
      const how =
        a.kind === "recommended"
          ? "went with your recommendation"
          : a.kind === "option"
            ? `picked option (${a.optionId})`
            : "wrote a manual answer";
      return `Q${i + 1} ${q.title} → ${a.text}\n   (${how})`;
    })
    .join("\n");
}

const ASIDE_BRIEFS: Record<Aside["kind"], { skill: string; brief: string; format: "markdown" | "html" }> = {
  "wait-what": {
    skill: "wait-what",
    format: "markdown",
    brief:
      "Re-pitch this question so it lands: give a little context (why this decision matters now, what depends on it), " +
      "then restate the question, each option and your recommendation in ASD-STE100 Simplified Technical English: short " +
      "sentences, one idea per sentence, common words, active voice. Use the project's ubiquitous language (CONTEXT.md if present). " +
      "Do not add new options. Keep it under ~250 words.",
  },
  "show-me": {
    skill: "show-me",
    format: "html",
    brief:
      "Make a visual for this question: a self-contained HTML fragment (inline <svg> and/or simple styled divs, inline CSS only, " +
      "no external resources, no scripts) that shows the decision and how the options differ — e.g. a comparison table, a " +
      "flow, an architecture sketch, a before/after. Mark the recommended option visually. Big shapes, few words. " +
      "Dark background friendly (light text on dark or transparent).",
  },
  eli5: {
    skill: "eli5",
    format: "html",
    brief:
      "Explain this question and its options like the reader knows nothing about the topic: a self-contained HTML fragment " +
      "with big simple pictures (inline SVG / emoji) and very few words, one concrete everyday analogy per option, and a " +
      "one-line 'so we pick…' for the recommendation. No scripts, no external resources, inline CSS only.",
  },
};

function asideInstruction(session: Session, aside: Aside): string {
  const round = session.rounds.find((r) => r.id === aside.roundId)!;
  const spec = ASIDE_BRIEFS[aside.kind];
  return [
    `status: aside_requested`,
    `The user pressed "${aside.kind}" on the question below and is waiting in the browser.`,
    ``,
    questionSummary(round, aside.questionId),
    ``,
    `Do this now:`,
    `1. If the "${spec.skill}" skill is available, invoke it about this question. Otherwise follow this brief: ${spec.brief}`,
    `2. Post the result with post_aside({ sessionId: "${session.id}", asideId: "${aside.id}", format: "${spec.format}", content }).`,
    `3. Call wait_for_answers again for the round.`,
    `Do not answer in the terminal; the user is looking at the browser.`,
  ].join("\n");
}

/* ---------- server ---------- */

const server = new McpServer({ name: "grill-ui", version: "0.1.0" });

server.registerTool(
  "open_session",
  {
    title: "Open a grilling session in the browser",
    description:
      "Start a grill-ui session and open the browser UI. Blocks until a browser tab connects (at most waitForBrowserMs) " +
      "and returns the sessionId and URL. Call once per grilling session, then use ask_round / wait_for_answers.",
    inputSchema: {
      title: z.string().min(1).describe("What is being grilled, e.g. 'Payment retry design'"),
      waitForBrowserMs: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(`How long to wait for a browser to connect (default ${DEFAULT_BROWSER_WAIT_MS}, max ${MAX_WAIT_MS})`),
    },
  },
  guard(async ({ title, waitForBrowserMs }) => {
    const session = store.createSession(title);
    const url = hub.urlFor(session.id);
    const opened = openBrowser(url);
    log(`session ${session.id} at ${url}`);
    const connected = await store.waitFor(
      session.id,
      (s) => (s.clients > 0 ? true : undefined),
      clampWait(waitForBrowserMs, DEFAULT_BROWSER_WAIT_MS),
    );
    const lines = [
      `sessionId: ${session.id}`,
      `url: ${url}`,
      `browserConnected: ${connected === true}`,
    ];
    if (connected !== true) {
      lines.push(
        opened
          ? "No browser connected yet. Tell the user to open the URL above, then continue; the page connects on load."
          : "Could not launch a browser automatically. Give the user the URL above to open manually.",
      );
    }
    lines.push(
      "",
      "Next: run the grilling skill as usual, but instead of printing a round, call ask_round with the frontier " +
        "(numbered questions with title, body, options if any, and your recommendation), then loop on wait_for_answers " +
        "until it returns status: answered. Keep terminal output minimal; the browser is the conversation surface.",
    );
    return text(lines.join("\n"));
  }),
);

const questionSchema = z.object({
  id: z.string().optional().describe("Stable id; defaults to r<round>q<n>"),
  title: z.string().min(1).describe("Short title, e.g. 'Transport'"),
  body: z.string().min(1).describe("The question, markdown. Can be several paragraphs."),
  options: z
    .array(
      z.object({
        id: z.string().optional().describe("Defaults to a, b, c…"),
        label: z.string().min(1),
        description: z.string().optional().describe("One-line explanation / trade-off (markdown)"),
      }),
    )
    .optional()
    .describe("Omit for an open question"),
  recommendation: z.string().min(1).describe("Your recommended answer, markdown (the ➡️ line)"),
  recommendedOptionId: z
    .string()
    .optional()
    .describe("If the recommendation is one of the options, its id, so 'Go with recommended' can select it"),
});

server.registerTool(
  "ask_round",
  {
    title: "Push a round of questions to the browser",
    description:
      "Publish one grilling round (the current frontier). Returns immediately with the roundId. Only one round can be " +
      "open at a time. Follow with wait_for_answers.",
    inputSchema: {
      sessionId: z.string(),
      intro: z.string().optional().describe("Optional short intro for the round (markdown), e.g. what the last answers settled"),
      questions: z.array(questionSchema).min(1),
    },
  },
  guard(async ({ sessionId, intro, questions }) => {
    const round = store.addRound(sessionId, questions, intro);
    return text(
      [
        `roundId: ${round.id}`,
        `round: ${round.index}`,
        `questionIds: ${round.questions.map((q) => q.id).join(", ")}`,
        `Next: call wait_for_answers({ sessionId: "${sessionId}", roundId: "${round.id}" }) and keep calling it while it returns pending.`,
      ].join("\n"),
    );
  }),
);

server.registerTool(
  "wait_for_answers",
  {
    title: "Wait for the user (poll)",
    description:
      "Block until something happens on the round, for at most timeoutMs. Returns one of: " +
      "`answered` (round submitted; answers included), `aside_requested` (user pressed Wait what / Show me / ELI5 on a " +
      "question: produce the aside, post_aside it, then call this again), `pending` (timeout; call again), " +
      "`closed` (session closed). Never blocks past timeoutMs, so it is safe to call in a loop.",
    inputSchema: {
      sessionId: z.string(),
      roundId: z.string(),
      timeoutMs: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(`Max block time (default ${DEFAULT_WAIT_MS}, cap ${MAX_WAIT_MS})`),
    },
  },
  guard(async ({ sessionId, roundId, timeoutMs }) => {
    store.getRound(sessionId, roundId); // validate
    type Outcome =
      | { kind: "answered"; round: Round }
      | { kind: "aside"; aside: Aside }
      | { kind: "closed" };
    const outcome = await store.waitFor<Outcome>(
      sessionId,
      (s) => {
        if (s.status === "closed") return { kind: "closed" };
        const aside = s.asides.find((a) => a.status === "requested");
        if (aside) return { kind: "aside", aside };
        const round = s.rounds.find((r) => r.id === roundId)!;
        if (round.status === "submitted") return { kind: "answered", round };
        return undefined;
      },
      clampWait(timeoutMs, DEFAULT_WAIT_MS),
    );

    const session = store.get(sessionId);
    if (!outcome) {
      const round = store.getRound(sessionId, roundId);
      const done = round.questions.filter((q) => round.answers[q.id]).length;
      return text(
        [
          `status: pending`,
          `progress: ${done}/${round.questions.length} answered (not submitted yet)`,
          `browserTabs: ${session.clients}`,
          session.clients === 0
            ? `No browser is connected. The user may have closed the tab; the URL is ${hub.urlFor(sessionId)}.`
            : `The user is still working. Call wait_for_answers again.`,
        ].join("\n"),
      );
    }
    switch (outcome.kind) {
      case "closed":
        return text("status: closed\nThe session was closed.");
      case "aside":
        store.claimAside(sessionId, outcome.aside.id);
        return text(asideInstruction(session, outcome.aside));
      case "answered":
        return text(
          [
            `status: answered`,
            `round: ${outcome.round.index}`,
            ``,
            formatAnswers(outcome.round),
            ``,
            `Next: recompute the frontier. If it is non-empty, ask_round again. If it is empty, post_note a summary of the ` +
              `shared understanding and ask the user to confirm it (as a final one-question round), then close_session.`,
          ].join("\n"),
        );
    }
  }),
);

server.registerTool(
  "post_aside",
  {
    title: "Deliver a Wait-what / Show-me / ELI5 result",
    description:
      "Send the content produced for an aside request into the contextual panel of the browser. " +
      "format 'markdown' renders as rich text; 'html' renders in a sandboxed frame (inline SVG/CSS ok, no scripts).",
    inputSchema: {
      sessionId: z.string(),
      asideId: z.string(),
      format: z.enum(["markdown", "html"]),
      content: z.string().min(1),
    },
  },
  guard(async ({ sessionId, asideId, format, content }) => {
    const a = store.resolveAside(sessionId, asideId, format, content);
    const openRound = store.get(sessionId).rounds.find((r) => r.status === "open");
    return text(
      `Posted ${a.kind} for ${a.questionId}.` +
        (openRound ? ` Next: wait_for_answers({ sessionId: "${sessionId}", roundId: "${openRound.id}" }).` : ""),
    );
  }),
);

server.registerTool(
  "post_note",
  {
    title: "Post a message in the chat column",
    description:
      "Show a free-form markdown message in the browser chat (between rounds): what the last answers settled, a summary " +
      "of the shared understanding, or a status like 'looking something up'.",
    inputSchema: { sessionId: z.string(), markdown: z.string().min(1) },
  },
  guard(async ({ sessionId, markdown }) => {
    const n = store.addNote(sessionId, markdown);
    return text(`Posted note ${n.id}.`);
  }),
);

server.registerTool(
  "close_session",
  {
    title: "Close the session",
    description: "Mark the session finished. The browser shows a closed banner; the tab can stay open for reference.",
    inputSchema: { sessionId: z.string() },
  },
  guard(async ({ sessionId }) => {
    store.closeSession(sessionId);
    return text(`Session ${sessionId} closed.`);
  }),
);

/* ---------- lifecycle ---------- */

const transport = new StdioServerTransport();
await server.connect(transport);
log(`ready (pid ${process.pid}), aside kinds: ${ASIDE_KINDS.join(", ")}`);

function shutdown(reason: string) {
  log(`shutting down (${reason})`);
  hub.stop();
  process.exit(0);
}
process.stdin.on("close", () => shutdown("stdin closed"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
