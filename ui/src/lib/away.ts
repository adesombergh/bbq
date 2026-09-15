/**
 * Away: how long this tab has been off screen, and when it opened. The
 * debrief's other numbers are derived from the snapshot and so are true in any
 * tab; this one has to be *watched* while it happens, which is why it lives in
 * a module store read through `useSyncExternalStore` rather than in
 * `lib/session-stats.ts` — the same shape as `lib/theme.ts` and
 * `lib/pastime/store.ts`, and the same reason none of them needs an effect
 * (docs/adr/0016-a-game-loop-needs-no-effect.md).
 *
 * It is browser-local and per tab: it reaches no Store, no protocol and no
 * snapshot, and a reload starts it again from zero. `sawWholeSession` in
 * `lib/session-stats.ts` is what stops a tab reporting a share of a session it
 * did not see.
 *
 * Away means *hidden*, not merely unfocused. A tab sitting visible beside your
 * editor counts as present — measuring focus would have caught that case, at
 * the cost of counting a click into devtools as leaving.
 */
import type { AwaySpan } from "@/lib/session-stats"

export interface Away {
  /** When this page loaded; the closest thing a tab has to its own birthday. */
  openedAt: number
  /**
   * Every stretch this page spent hidden, rather than one running total: a
   * closed tab is meant to be kept, so the clock outlives the session it is
   * describing and only the spans inside the session's own window count.
   * `awayWithin` in `lib/session-stats.ts` is what does the clamping.
   */
  spans: AwaySpan[]
}

const openedAt = Date.now()

const listeners = new Set<() => void>()
const spans: AwaySpan[] = []

let hiddenSince: number | undefined =
  document.visibilityState === "hidden" ? openedAt : undefined

/** One stable object per change: getSnapshot must not build a new one per call. */
let snapshot: Away = { openedAt, spans: [] }

const publish = (): void => {
  snapshot = { openedAt, spans: [...spans] }
  for (const listener of listeners) {
    listener()
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    hiddenSince = Date.now()
    return
  }
  if (hiddenSince === undefined) {
    return
  }
  spans.push({ from: hiddenSince, to: Date.now() })
  hiddenSince = undefined
  // Only on the way back: nothing renders this while the tab is hidden.
  publish()
})

export const getAway = (): Away => snapshot

export const subscribeAway = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
