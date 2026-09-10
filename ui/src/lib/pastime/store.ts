/**
 * The pastime's tick, living outside React (like lib/theme.ts). The interval
 * opens on the first arrow key and closes when the run ends or when the last
 * board unsubscribes — and the last board unsubscribes exactly when the round
 * opens and the lull stops rendering. So `useSyncExternalStore`'s unsubscribe
 * is the whole teardown and no component runs an effect.
 *
 * See docs/adr/0016-a-game-loop-needs-no-effect.md.
 */
import type { Direction, Run } from "./snake-rules"

import { canTurn, initialRun, step } from "./snake-rules"

const TICK_MS = 110
const STORAGE_KEY = "grill-ui:pastime-best"

const ARROWS: Record<string, Direction> = {
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
}

export interface Pastime {
  best: number
  run: Run
  running: boolean
}

const readBest = (): number => {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isInteger(stored) && stored > 0 ? stored : 0
  } catch {
    // Storage can be blocked (private windows, hardened settings).
    return 0
  }
}

const writeBest = (value: number): void => {
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // Not being able to remember a best run is no reason to interrupt one.
  }
}

const listeners = new Set<() => void>()

let best = readBest()
let run = initialRun(Date.now())
let queued: Direction | undefined
let timer: ReturnType<typeof setInterval> | undefined

/** One stable object per change: getSnapshot must not build a new one per call. */
let snapshot: Pastime = { best, run, running: false }

const publish = (): void => {
  snapshot = { best, run, running: timer !== undefined }
  for (const listener of listeners) {
    listener()
  }
}

const stopTimer = (): void => {
  if (timer !== undefined) {
    clearInterval(timer)
    timer = undefined
  }
}

const tick = (): void => {
  run = step(run, queued)
  queued = undefined
  if (run.score > best) {
    best = run.score
    writeBest(best)
  }
  if (run.over) {
    stopTimer()
  }
  publish()
}

export const getPastime = (): Pastime => snapshot

export const subscribePastime = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      // The board went with the lull: stop ticking and forget the run, so the
      // next lull starts from a fresh idle board.
      stopTimer()
      queued = undefined
      run = initialRun(Date.now())
      publish()
    }
  }
}

export const directionForKey = (key: string): Direction | undefined =>
  ARROWS[key]

/** An arrow key: starts an idle board, restarts a finished one, else steers. */
export const turn = (direction: Direction): void => {
  if (run.over) {
    run = initialRun(Date.now())
  }
  if (canTurn(run, direction)) {
    queued = direction
  }
  timer ??= setInterval(tick, TICK_MS)
  publish()
}

// The arrows reach the snake without the board being focused, which is what
// makes "press an arrow key to start" true — but they stand down the moment
// anything else is focused, so tabbing or clicking into the timeline or the
// aside panel hands them back to the ScrollArea.
window.addEventListener("keydown", (event) => {
  if (listeners.size === 0 || document.activeElement !== document.body) {
    return
  }
  const direction = directionForKey(event.key)
  if (direction === undefined) {
    return
  }
  event.preventDefault()
  turn(direction)
})
