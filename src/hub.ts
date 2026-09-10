/**
 * HTTP + WebSocket hub. Serves the prebuilt UI out of ui/dist and relays
 * state <-> browser over WS. It never talks to the MCP layer; both sides only
 * know the Store.
 *
 * Auth: every request needs the process token, either as `?token=` (first
 * navigation, which then sets an HttpOnly cookie) or via that cookie.
 */
import { existsSync } from "node:fs";
import { join, normalize } from "node:path";
import type { ServerWebSocket } from "bun";
import type { Store } from "./state.ts";
import type { ClientMessage, ServerMessage, Session } from "./types.ts";

const COOKIE = "grill_token";

interface WsData {
  sessionId: string;
}

export interface Hub {
  port: number;
  /** URL that opens the UI for a session (carries the token). */
  urlFor(sessionId: string): string;
  stop(): void;
}

export interface HubOptions {
  store: Store;
  token: string;
  /** Directory holding the built UI (index.html + assets/). */
  distDir: string;
  hostname?: string;
  port?: number;
}

function log(...args: unknown[]) {
  console.error("[grill-ui]", ...args);
}

function readCookie(req: Request): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function startHub(opts: HubOptions): Hub {
  const { store, token, distDir } = opts;
  const hostname = opts.hostname ?? "127.0.0.1";
  const hasDist = existsSync(join(distDir, "index.html"));
  if (!hasDist) log(`ui/dist not found at ${distDir}; run \`bun run build\` first. Serving a placeholder page.`);

  // sessionId -> sockets
  const sockets = new Map<string, Set<ServerWebSocket<WsData>>>();
  const unsubscribers = new Map<string, () => void>();

  function broadcast(session: Session) {
    const set = sockets.get(session.id);
    if (!set || set.size === 0) return;
    const payload = JSON.stringify({ type: "state", session } satisfies ServerMessage);
    for (const ws of set) {
      try {
        ws.send(payload);
      } catch (err) {
        log("ws send failed", err);
      }
    }
  }

  function ensureSubscribed(sessionId: string) {
    if (unsubscribers.has(sessionId)) return;
    unsubscribers.set(sessionId, store.subscribe(sessionId, broadcast));
  }

  function authorized(req: Request, url: URL): boolean {
    const q = url.searchParams.get("token");
    if (q && safeEqual(q, token)) return true;
    const c = readCookie(req);
    return !!c && safeEqual(c, token);
  }

  const server = Bun.serve<WsData>({
    hostname,
    port: opts.port ?? 0,
    // Rounds may sit open for an hour: never let Bun kill an idle connection.
    idleTimeout: 0,
    development: false,

    async fetch(req, server) {
      const url = new URL(req.url);

      if (!authorized(req, url)) {
        return new Response("Forbidden: missing or invalid token", { status: 403 });
      }

      // WebSocket upgrade: /ws?session=<id>
      if (url.pathname === "/ws") {
        const sessionId = url.searchParams.get("session") ?? "";
        if (!store.has(sessionId)) return new Response("Unknown session", { status: 404 });
        const ok = server.upgrade(req, { data: { sessionId } });
        return ok ? undefined : new Response("Upgrade failed", { status: 400 });
      }

      // Small JSON API, handy for debugging and for the placeholder page.
      if (url.pathname === "/api/sessions") {
        return Response.json(store.list().map((s) => ({ id: s.id, title: s.title, status: s.status })));
      }
      if (url.pathname.startsWith("/api/session/")) {
        const id = url.pathname.slice("/api/session/".length);
        if (!store.has(id)) return new Response("Unknown session", { status: 404 });
        return Response.json(store.get(id));
      }

      // Static UI. `/` and `/s/<id>` both serve index.html (client-side routing).
      const isIndex = url.pathname === "/" || url.pathname === "/index.html" || url.pathname.startsWith("/s/");
      const headers = new Headers();
      // Token arrived in the query: persist it as an HttpOnly cookie so that
      // assets and the WS upgrade are authorized without leaking it in URLs.
      if (url.searchParams.has("token")) {
        headers.set(
          "Set-Cookie",
          `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict`,
        );
      }

      if (isIndex) {
        if (!hasDist) {
          headers.set("Content-Type", "text/html; charset=utf-8");
          return new Response(placeholderHtml(), { headers });
        }
        headers.set("Cache-Control", "no-store");
        return new Response(Bun.file(join(distDir, "index.html")), { headers });
      }

      // Assets: prevent path traversal, only serve from distDir.
      const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
      const filePath = join(distDir, rel);
      if (!filePath.startsWith(distDir)) return new Response("Not found", { status: 404 });
      const file = Bun.file(filePath);
      if (!(await file.exists())) return new Response("Not found", { status: 404 });
      if (rel.startsWith("/assets/")) headers.set("Cache-Control", "public, max-age=31536000, immutable");
      return new Response(file, { headers });
    },

    websocket: {
      idleTimeout: 0,
      open(ws) {
        const { sessionId } = ws.data;
        ensureSubscribed(sessionId);
        let set = sockets.get(sessionId);
        if (!set) {
          set = new Set();
          sockets.set(sessionId, set);
        }
        set.add(ws);
        // setClients emits -> broadcast gives the newcomer its first snapshot.
        store.setClients(sessionId, +1);
        log(`browser connected to ${sessionId} (${set.size} tab(s))`);
      },
      message(ws, raw) {
        const { sessionId } = ws.data;
        let msg: ClientMessage;
        try {
          msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw)) as ClientMessage;
        } catch {
          ws.send(JSON.stringify({ type: "error", message: "Malformed JSON" } satisfies ServerMessage));
          return;
        }
        try {
          store.apply(sessionId, msg);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log(`rejected ${msg.type}: ${message}`);
          ws.send(JSON.stringify({ type: "error", message } satisfies ServerMessage));
          // Re-sync the client so its optimistic UI snaps back.
          ws.send(JSON.stringify({ type: "state", session: store.get(sessionId) } satisfies ServerMessage));
        }
      },
      close(ws) {
        const { sessionId } = ws.data;
        sockets.get(sessionId)?.delete(ws);
        if (store.has(sessionId)) store.setClients(sessionId, -1);
        log(`browser disconnected from ${sessionId}`);
      },
    },
  });

  log(`hub listening on http://${hostname}:${server.port}`);

  return {
    port: server.port ?? 0,
    urlFor(sessionId) {
      return `http://${hostname}:${server.port}/s/${sessionId}?token=${encodeURIComponent(token)}`;
    },
    stop() {
      for (const u of unsubscribers.values()) u();
      server.stop(true);
    },
  };
}

function placeholderHtml(): string {
  return `<!doctype html><meta charset="utf-8"><title>grill-ui</title>
<body style="font:16px system-ui;background:#111;color:#eee;padding:3rem;max-width:40rem;margin:auto">
<h1>grill-ui</h1>
<p>The UI bundle is missing. Build it once, then reload this page:</p>
<pre style="background:#222;padding:1rem;border-radius:.5rem">cd &lt;grill-ui&gt; &amp;&amp; bun install &amp;&amp; bun run build</pre>
<p>The MCP server never runs the bundler itself (stdout belongs to MCP, and startup must stay instant).</p>
</body>`;
}
