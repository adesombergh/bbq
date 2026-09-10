import type { Session } from "@shared/types"

import { queryOptions } from "@tanstack/react-query"

const isSession = (value: unknown): value is Session =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  "rounds" in value &&
  Array.isArray(value.rounds) &&
  "asides" in value &&
  Array.isArray(value.asides) &&
  "notes" in value &&
  Array.isArray(value.notes)

export const sessionKey = (sessionId: string) => ["session", sessionId] as const

/**
 * The session mirror. The HTTP endpoint gives the first snapshot so a page
 * load renders immediately; afterwards the WebSocket keeps this cache entry
 * fresh through `setQueryData`, so it never goes stale on its own.
 */
export const sessionQueryOptions = (sessionId: string) =>
  queryOptions({
    queryFn: async ({ signal }): Promise<Session> => {
      const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}`, {
        signal,
      })
      if (!res.ok) {
        throw new Error(
          res.status === 404
            ? `Unknown session ${sessionId}`
            : `Hub answered ${res.status}`
        )
      }
      const data: unknown = await res.json()
      if (!isSession(data)) {
        throw new Error("Hub returned an unexpected payload")
      }
      return data
    },
    queryKey: sessionKey(sessionId),
    staleTime: Number.POSITIVE_INFINITY,
  })
