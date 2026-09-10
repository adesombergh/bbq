/**
 * Snake's rules: one pure step over an immutable run. No DOM, no timers and no
 * React — the interval that drives this lives in ./store.ts. `test/pastime.test.ts`
 * imports this module under the root tsconfig, whose `lib` has no DOM in it, so
 * reaching for `window` in here fails to typecheck.
 *
 * See docs/adr/0016-a-game-loop-needs-no-effect.md.
 */

export const COLS = 20
export const ROWS = 14

const TAIL_AT_START = 3

/** An LCG, so a food spawn is reproducible from the seed that produced it. */
const LCG_MULTIPLIER = 1_664_525
const LCG_INCREMENT = 1_013_904_223
const LCG_MODULUS = 4_294_967_296

export const DIRECTIONS = ["down", "left", "right", "up"] as const

export type Direction = (typeof DIRECTIONS)[number]

export interface Cell {
  x: number
  y: number
}

export interface Run {
  direction: Direction
  food: Cell
  over: boolean
  score: number
  seed: number
  /** Head first, so the next step always comes from `snake[0]`. */
  snake: Cell[]
}

const DELTA: Record<Direction, Cell> = {
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
}

const OPPOSITE: Record<Direction, Direction> = {
  down: "up",
  left: "right",
  right: "left",
  up: "down",
}

/** Every cell of the board, built once: food spawns by picking a free one. */
const ALL_CELLS: Cell[] = Array.from({ length: ROWS }, (_row, y) =>
  Array.from({ length: COLS }, (_column, x): Cell => ({ x, y }))
).flat()

const keyOf = (cell: Cell): number => cell.y * COLS + cell.x

const nextSeed = (seed: number): number =>
  (seed * LCG_MULTIPLIER + LCG_INCREMENT) % LCG_MODULUS

const sameCell = (one: Cell, other: Cell): boolean =>
  one.x === other.x && one.y === other.y

interface Spawn {
  food: Cell
  seed: number
}

/** A free cell chosen from `seed`, or undefined once the snake fills the board. */
const spawnFood = (snake: Cell[], seed: number): Spawn | undefined => {
  const taken = new Set(snake.map(keyOf))
  const free = ALL_CELLS.filter((cell) => !taken.has(keyOf(cell)))
  const seeded = nextSeed(seed)
  const food = free[seeded % free.length]
  return food === undefined ? undefined : { food, seed: seeded }
}

export const initialRun = (seed: number): Run => {
  const y = Math.floor(ROWS / 2)
  const x = Math.floor(COLS / 2)
  const snake = Array.from(
    { length: TAIL_AT_START },
    (_segment, index): Cell => ({ x: x - index, y })
  )
  const spawn = spawnFood(snake, seed)
  return {
    direction: "right",
    food: spawn?.food ?? { x: 0, y: 0 },
    over: false,
    score: 0,
    seed: spawn?.seed ?? seed,
    snake,
  }
}

/** Whether the run can be steered to `direction`: no reversing into your neck. */
export const canTurn = (run: Run, direction: Direction): boolean =>
  direction !== OPPOSITE[run.direction]

/** One tick. `queued` is the last arrow key pressed since the previous tick. */
export const step = (run: Run, queued?: Direction): Run => {
  if (run.over) {
    return run
  }
  const direction =
    queued !== undefined && canTurn(run, queued) ? queued : run.direction
  const [head] = run.snake
  if (head === undefined) {
    return { ...run, over: true }
  }
  const delta = DELTA[direction]
  const next: Cell = { x: head.x + delta.x, y: head.y + delta.y }
  if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
    return { ...run, direction, over: true }
  }
  const eating = sameCell(next, run.food)
  // The tail vacates its cell on this same tick, so moving into it is legal.
  const body = eating ? run.snake : run.snake.slice(0, -1)
  if (body.some((cell) => sameCell(cell, next))) {
    return { ...run, direction, over: true }
  }
  const snake = [next, ...body]
  if (!eating) {
    return { ...run, direction, snake }
  }
  const spawn = spawnFood(snake, run.seed)
  if (spawn === undefined) {
    return { ...run, direction, over: true, score: run.score + 1, snake }
  }
  return {
    direction,
    food: spawn.food,
    over: false,
    score: run.score + 1,
    seed: spawn.seed,
    snake,
  }
}
