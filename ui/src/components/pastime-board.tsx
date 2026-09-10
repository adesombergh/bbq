import { useSyncExternalStore } from "react"

import { COLS, ROWS } from "@/lib/pastime/snake-rules"
import {
  directionForKey,
  getPastime,
  subscribePastime,
  turn,
} from "@/lib/pastime/store"
import { cn } from "@/lib/utils"

const cellPosition = (x: number, y: number) => ({
  gridColumn: x + 1,
  gridRow: y + 1,
})

const boardStyle = {
  aspectRatio: `${COLS} / ${ROWS}`,
  gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
  gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
}

/**
 * Snake, offered during a lull. The board is inert until an arrow key is
 * pressed and it unmounts with the lull, which is also what stops the tick
 * (docs/adr/0016-a-game-loop-needs-no-effect.md).
 */
export const PastimeBoard = () => {
  const { best, run, running } = useSyncExternalStore(
    subscribePastime,
    getPastime
  )

  let hint = "Press an arrow key to play"
  if (run.over) {
    hint = "Game over — press an arrow key to play again"
  } else if (running) {
    hint = "Arrow keys to steer"
  }

  return (
    <div className="max-w-sm rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-baseline justify-between text-xs text-muted-foreground">
        <span>Snake</span>
        <span aria-live="polite" className="tabular-nums">
          {run.score} · best {best}
        </span>
      </div>
      {/* A button, so the board is focusable and keyboard-operable by default:
          clicking or pressing it starts a run, then the arrows steer. */}
      <button
        aria-label="Snake. Press an arrow key to play."
        className="grid w-full gap-px rounded bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          turn("right")
        }}
        onKeyDown={(event) => {
          const direction = directionForKey(event.key)
          if (direction === undefined) {
            return
          }
          event.preventDefault()
          turn(direction)
        }}
        style={boardStyle}
        type="button"
      >
        <div
          className="rounded-[1px] bg-info"
          style={cellPosition(run.food.x, run.food.y)}
        />
        {run.snake.map((cell, index) => (
          <div
            className={cn(
              "rounded-[1px]",
              index === 0 ? "bg-primary" : "bg-primary/60"
            )}
            key={`${cell.x}:${cell.y}`}
            style={cellPosition(cell.x, cell.y)}
          />
        ))}
      </button>
      <p className="mt-2 text-center text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
