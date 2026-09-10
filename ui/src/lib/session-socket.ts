/**
 * One WebSocket per session, living outside React. Server frames are written
 * straight into the Query cache; connection status lives in a tiny store.
 * Reconnects use TanStack Pacer's AsyncRetryer for the backoff schedule.
 */
import type { ClientMessage, ServerMessage, Session } from "@shared/types"
import type { QueryClient } from "@tanstack/react-query"

import { AsyncRetryer } from "@tanstack/react-pacer"
import { Store } from "@tanstack/store"

import { sessionKey } from "./session-query"

export type ConnectionStatus = "connecting" | "open" | "closed"

export interface ConnectionState {
  status: ConnectionStatus
  attempt: number
  /** Last error reported by the hub or the socket; cleared after a moment. */
  error: string | null
}

export interface SessionConnection {
  store: Store<ConnectionState>
  /** Resolves when the hub broadcasts the resulting state; rejects if it refuses the message. */
  send: (message: ClientMessage) => Promise<void>
}

const BASE_WAIT_MS = 500
const MAX_WAIT_MS = 10_000
const ERROR_TTL_MS = 4000
const ACK_TIMEOUT_MS = 5000

const connections = new Map<string, SessionConnection>()

function isServerMessage(value: unknown): value is ServerMessage {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false
  }
  return value.type === "state" || value.type === "error"
}

function socketUrl(sessionId: string): string {
  const proto = location.protocol === "https:" ? "wss" : "ws"
  return `${proto}://${location.host}/ws?session=${encodeURIComponent(sessionId)}`
}

export function connectSession(
  queryClient: QueryClient,
  sessionId: string
): SessionConnection {
  const existing = connections.get(sessionId)
  if (existing) {
    return existing
  }

  const store = new Store<ConnectionState>({
    attempt: 0,
    error: null,
    status: "connecting",
  })
  let socket: WebSocket | null = null
  let errorTimer: ReturnType<typeof setTimeout> | undefined
  /** Messages awaiting the hub's answer, oldest first. */
  const inFlight: { resolve: () => void; reject: (error: Error) => void }[] = []

  const settleOldest = (error?: Error): void => {
    const oldest = inFlight.shift()
    if (!oldest) {
      return
    }
    if (error) {
      oldest.reject(error)
    } else {
      oldest.resolve()
    }
  }

  const setError = (error: string): void => {
    store.setState((state) => ({ ...state, error }))
    clearTimeout(errorTimer)
    errorTimer = setTimeout(() => {
      store.setState((state) => ({ ...state, error: null }))
    }, ERROR_TTL_MS)
  }

  const handleFrame = (raw: unknown): void => {
    let parsed: unknown
    try {
      parsed = JSON.parse(String(raw))
    } catch {
      return
    }
    if (!isServerMessage(parsed)) {
      return
    }
    if (parsed.type === "state") {
      queryClient.setQueryData<Session>(sessionKey(sessionId), parsed.session)
      // The hub broadcasts state after every accepted message.
      settleOldest()
      return
    }
    setError(parsed.message)
    settleOldest(new Error(parsed.message))
  }

  /** Resolves once the socket is open; rejects if it closes before that. */
  const openSocket = async (): Promise<WebSocket> => {
    store.setState((state) => ({ ...state, status: "connecting" }))
    const ws = new WebSocket(socketUrl(sessionId))
    const { promise, resolve, reject } = Promise.withResolvers<WebSocket>()
    ws.addEventListener("open", () => {
      socket = ws
      store.setState((state) => ({ ...state, attempt: 0, status: "open" }))
      resolve(ws)
    })
    ws.addEventListener("message", (event) => {
      handleFrame(event.data)
    })
    ws.addEventListener("error", () => {
      ws.close()
    })
    ws.addEventListener("close", () => {
      const wasOpen = socket === ws
      socket = null
      store.setState((state) => ({ ...state, status: "closed" }))
      const session = queryClient.getQueryData<Session>(sessionKey(sessionId))
      if (session?.status === "closed") {
        // The session is over; the hub going away is expected.
        return
      }
      if (wasOpen) {
        // Lost an established connection: start a fresh retry cycle.
        void retryer.execute()
      } else {
        reject(new Error("socket closed before opening"))
      }
    })
    return await promise
  }

  const retryer = new AsyncRetryer(openSocket, {
    backoff: "exponential",
    baseWait: BASE_WAIT_MS,
    maxAttempts: Number.MAX_SAFE_INTEGER,
    maxWait: MAX_WAIT_MS,
    onRetry: (attempt) => {
      store.setState((state) => ({ ...state, attempt }))
    },
    throwOnError: false,
  })
  void retryer.execute()

  const send = async (message: ClientMessage): Promise<void> => {
    if (socket?.readyState !== WebSocket.OPEN) {
      setError("Not connected to the hub")
      throw new Error("Not connected to the hub")
    }
    const { promise, resolve, reject } = Promise.withResolvers<null>()
    const entry = {
      reject,
      resolve: () => {
        resolve(null)
      },
    }
    inFlight.push(entry)
    const timer = setTimeout(() => {
      const index = inFlight.indexOf(entry)
      if (index !== -1) {
        inFlight.splice(index, 1)
        reject(new Error("The hub did not answer in time"))
      }
    }, ACK_TIMEOUT_MS)
    socket.send(JSON.stringify(message))
    try {
      await promise
    } finally {
      clearTimeout(timer)
    }
  }

  const connection: SessionConnection = { send, store }
  connections.set(sessionId, connection)
  return connection
}

export function getConnection(sessionId: string): SessionConnection {
  const connection = connections.get(sessionId)
  if (!connection) {
    throw new Error(`No connection for session ${sessionId}`)
  }
  return connection
}
