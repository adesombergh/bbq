/**
 * HTTP + WebSocket hub. Serves the prebuilt UI out of ui/dist and relays
 * state <-> browser over WS. It never talks to the MCP layer; both sides only
 * know the Store.
 *
 * Auth: every request needs the process token, either as `?token=` (first
 * navigation, which then sets an HttpOnly cookie) or via that cookie.
 */
import type { Store } from "./state.ts"
import type { ServerMessage, Session } from "./types.ts"
import type { ServerWebSocket } from "bun"

import { timingSafeEqual } from "node:crypto"
import { existsSync } from "node:fs"
import path from "node:path"

import { parseClientMessage } from "./protocol.ts"

const COOKIE = "bbq_token"
const ONE_YEAR_SECONDS = 31_536_000
const TRAVERSAL_PREFIX = /^(?<dots>\.\.[/\\])+/u

interface WsData {
  sessionId: string
}

export interface Hub {
  port: number
  /** URL that opens the UI for a session (carries the token). */
  urlFor: (sessionId: string) => string
  stop: () => void
}

export interface HubOptions {
  store: Store
  token: string
  /** Directory holding the built UI (index.html + assets/). */
  distDir: string
  hostname?: string
  port?: number
}

function log(...args: unknown[]): void {
  console.error("[bbq]", ...args)
}

function readCookie(req: Request): string | undefined {
  const header = req.headers.get("cookie")
  if (header === null) {
    return undefined
  }
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=")
    if (key === COOKIE) {
      return decodeURIComponent(rest.join("="))
    }
  }
  return undefined
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function encode(message: ServerMessage): string {
  return JSON.stringify(message)
}

function placeholderHtml(): string {
  return `<!doctype html><meta charset="utf-8"><title>bbq</title>
<body style="font:16px system-ui;background:#111;color:#eee;padding:3rem;max-width:40rem;margin:auto">
<h1>bbq</h1>
<p>The UI bundle is missing. Build it once, then reload this page:</p>
<pre style="background:#222;padding:1rem;border-radius:.5rem">cd &lt;bbq&gt; &amp;&amp; bun install &amp;&amp; bun run build</pre>
<p>The MCP server never runs the bundler itself (stdout belongs to MCP, and startup must stay instant).</p>
</body>`
}

export function startHub(opts: HubOptions): Hub {
  const { store, token, distDir } = opts
  const hostname = opts.hostname ?? "127.0.0.1"
  const hasDist = existsSync(path.join(distDir, "index.html"))
  if (!hasDist) {
    log(
      `ui/dist not found at ${distDir}; run \`bun run build\` first. Serving a placeholder page.`
    )
  }

  const sockets = new Map<string, Set<ServerWebSocket<WsData>>>()
  const unsubscribers = new Map<string, () => void>()

  function broadcast(session: Session): void {
    const set = sockets.get(session.id)
    if (!set || set.size === 0) {
      return
    }
    const payload = encode({ session, type: "state" })
    for (const ws of set) {
      try {
        ws.send(payload)
      } catch (error) {
        log("ws send failed", error)
      }
    }
  }

  function ensureSubscribed(sessionId: string): void {
    if (unsubscribers.has(sessionId)) {
      return
    }
    unsubscribers.set(sessionId, store.subscribe(sessionId, broadcast))
  }

  function authorized(req: Request, url: URL): boolean {
    const fromQuery = url.searchParams.get("token")
    if (fromQuery !== null && safeEqual(fromQuery, token)) {
      return true
    }
    const fromCookie = readCookie(req)
    return fromCookie !== undefined && safeEqual(fromCookie, token)
  }

  async function serveAsset(url: URL, headers: Headers): Promise<Response> {
    // Prevent path traversal, only serve from distDir.
    const rel = path
      .normalize(decodeURIComponent(url.pathname))
      .replace(TRAVERSAL_PREFIX, "")
    const filePath = path.join(distDir, rel)
    if (!filePath.startsWith(distDir)) {
      return new Response("Not found", { status: 404 })
    }
    const file = Bun.file(filePath)
    const exists = await file.exists()
    if (!exists) {
      return new Response("Not found", { status: 404 })
    }
    if (rel.startsWith("/assets/")) {
      headers.set(
        "Cache-Control",
        `public, max-age=${ONE_YEAR_SECONDS}, immutable`
      )
    }
    return new Response(file, { headers })
  }

  const server = Bun.serve<WsData>({
    development: false,
    async fetch(req, bunServer) {
      const url = new URL(req.url)

      if (!authorized(req, url)) {
        return new Response("Forbidden: missing or invalid token", {
          status: 403,
        })
      }

      // WebSocket upgrade: /ws?session=<id>
      if (url.pathname === "/ws") {
        const sessionId = url.searchParams.get("session") ?? ""
        if (!store.has(sessionId)) {
          return new Response("Unknown session", { status: 404 })
        }
        const ok = bunServer.upgrade(req, { data: { sessionId } })
        return ok ? undefined : new Response("Upgrade failed", { status: 400 })
      }

      // Small JSON API: initial load for the UI, handy for debugging.
      if (url.pathname === "/api/sessions") {
        return Response.json(
          store
            .list()
            .map((s) => ({ id: s.id, status: s.status, title: s.title }))
        )
      }
      if (url.pathname.startsWith("/api/session/")) {
        const id = url.pathname.slice("/api/session/".length)
        if (!store.has(id)) {
          return new Response("Unknown session", { status: 404 })
        }
        return Response.json(store.get(id))
      }

      // Static UI. `/` and `/s/<id>` both serve index.html (client-side routing).
      const isIndex =
        url.pathname === "/" ||
        url.pathname === "/index.html" ||
        url.pathname.startsWith("/s/")
      const headers = new Headers()
      // Token arrived in the query: persist it as an HttpOnly cookie so that
      // assets and the WS upgrade are authorized without leaking it in URLs.
      if (url.searchParams.has("token")) {
        headers.set(
          "Set-Cookie",
          `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict`
        )
      }

      if (isIndex) {
        if (!hasDist) {
          headers.set("Content-Type", "text/html; charset=utf-8")
          return new Response(placeholderHtml(), { headers })
        }
        headers.set("Cache-Control", "no-store")
        return new Response(Bun.file(path.join(distDir, "index.html")), {
          headers,
        })
      }

      return await serveAsset(url, headers)
    },
    hostname,
    // Rounds may sit open for an hour: never let Bun kill an idle connection.
    idleTimeout: 0,
    port: opts.port ?? 0,

    websocket: {
      close(ws) {
        const { sessionId } = ws.data
        sockets.get(sessionId)?.delete(ws)
        if (store.has(sessionId)) {
          store.setTabs(sessionId, -1)
        }
        log(`browser disconnected from ${sessionId}`)
      },
      idleTimeout: 0,
      message(ws, raw) {
        const { sessionId } = ws.data
        const text =
          typeof raw === "string" ? raw : new TextDecoder().decode(raw)
        const parsed = parseClientMessage(text)
        if (!parsed.ok) {
          ws.send(encode({ message: parsed.error, type: "error" }))
          return
        }
        try {
          store.apply(sessionId, parsed.message)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          log(`rejected ${parsed.message.type}: ${message}`)
          ws.send(encode({ message, type: "error" }))
          // Re-sync the client so its optimistic UI snaps back.
          ws.send(encode({ session: store.get(sessionId), type: "state" }))
        }
      },
      open(ws) {
        const { sessionId } = ws.data
        ensureSubscribed(sessionId)
        const set = sockets.get(sessionId) ?? new Set<ServerWebSocket<WsData>>()
        sockets.set(sessionId, set)
        set.add(ws)
        // setTabs emits -> broadcast gives the newcomer its first snapshot.
        store.setTabs(sessionId, 1)
        log(`browser connected to ${sessionId} (${set.size} tab(s))`)
      },
    },
  })

  log(`hub listening on http://${hostname}:${server.port}`)

  return {
    port: server.port ?? 0,
    stop() {
      for (const unsubscribe of unsubscribers.values()) {
        unsubscribe()
      }
      void server.stop(true)
    },
    urlFor(sessionId) {
      return `http://${hostname}:${server.port}/s/${sessionId}?token=${encodeURIComponent(token)}`
    },
  }
}
