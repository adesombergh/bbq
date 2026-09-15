/**
 * How long the current lull has lasted, as one bit: has it gone on long enough
 * to be worth offering the pastime for?
 *
 * Every gap between rounds is a lull, including the short one between the last
 * answer and `close_session` landing. Offering snake in that gap put a board on
 * screen for a second or two on the way to the debrief, which reads as the
 * session starting something rather than ending. A lull only earns a board once
 * it has lasted `GRACE_MS`; before that it is just the line.
 *
 * The clock starts when the lull mounts and is thrown away when it unmounts,
 * which is the same no-effect shape as `lib/pastime/store.ts`: the store never
 * has to be told about mounting, so `useSyncExternalStore`'s unsubscribe is the
 * whole cleanup (docs/adr/0016-a-game-loop-needs-no-effect.md).
 */
const GRACE_MS = 4000

const listeners = new Set<() => void>()

let settled = false
let timer: ReturnType<typeof setTimeout> | undefined

const publish = (): void => {
  for (const listener of listeners) {
    listener()
  }
}

/** Exported for the test: a lull's clock, without a React tree around it. */
export const lullGraceMs = GRACE_MS

export const getLullSettled = (): boolean => settled

export const subscribeLullSettled = (listener: () => void): (() => void) => {
  listeners.add(listener)
  timer ??= setTimeout(() => {
    settled = true
    publish()
  }, GRACE_MS)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      // The lull ended: a round opened, or the session closed. The next lull
      // waits out its own grace rather than inheriting this one's.
      clearTimeout(timer)
      timer = undefined
      settled = false
    }
  }
}
