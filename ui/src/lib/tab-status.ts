/**
 * The browser tab as a status light: the title says how many questions are
 * waiting on you, the favicon says whose turn it is at a glance in a pinned tab.
 *
 * This watches the Query cache rather than the WebSocket on purpose. An answer
 * is patched into the cache optimistically (lib/session-mutations.ts) before
 * the hub echoes a snapshot back, and that patch is exactly the moment the
 * count changes — reading socket frames would leave the tab a round-trip stale.
 */
import type { TabState } from "@shared/round-rules"
import type { Session } from "@shared/types"
import type { QueryClient } from "@tanstack/react-query"

import { hashKey } from "@tanstack/react-query"

import { tabLabel, tabState } from "@shared/round-rules"

import { sessionKey } from "./session-query"

const FAVICONS: Record<TabState, string> = {
  awaiting: "❓",
  closed: "✅",
  thinking: "🔥",
}

/**
 * One tab shows one session at a time. Sockets of previously visited sessions
 * keep writing into the cache, so the watcher tracks the session the route is
 * on rather than every session it has ever seen.
 */
let watched: { sessionId: string; hash: string } | undefined
let subscribed = false

/** The same data-URI emoji trick as the static favicon in index.html. */
const iconHref = (emoji: string): string => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${emoji}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const paint = (session: Session): void => {
  document.title = tabLabel(session)
  const link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
  if (link) {
    link.href = iconHref(FAVICONS[tabState(session)])
  }
}

/** Point the tab at one session. Safe to call on every navigation. */
export function watchTabStatus(
  queryClient: QueryClient,
  sessionId: string
): void {
  watched = { hash: hashKey(sessionKey(sessionId)), sessionId }
  const update = (): void => {
    if (!watched) {
      return
    }
    const session = queryClient.getQueryData<Session>(
      sessionKey(watched.sessionId)
    )
    if (session) {
      paint(session)
    }
  }
  if (!subscribed) {
    subscribed = true
    queryClient.getQueryCache().subscribe((event) => {
      if (event.query.queryHash === watched?.hash) {
        update()
      }
    })
  }
  update()
}
