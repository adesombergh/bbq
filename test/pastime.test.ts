import type { Cell, Run } from "../ui/src/lib/pastime/snake-rules"

import { describe, expect, test } from "bun:test"

import { COLS, initialRun, ROWS, step } from "../ui/src/lib/pastime/snake-rules"

const runFacingRight = (snake: Cell[], food: Cell): Run => ({
  direction: "right",
  food,
  over: false,
  score: 0,
  seed: 1,
  snake,
})

describe("snake rules", () => {
  test("food never spawns on the snake", () => {
    for (const seed of Array.from({ length: 200 }, (_unused, i) => i)) {
      const run = initialRun(seed)
      expect(
        run.snake.some((cell) => cell.x === run.food.x && cell.y === run.food.y)
      ).toBe(false)
    }
  })

  test("a reversal into your own neck is ignored", () => {
    const run = initialRun(7)
    const [head] = run.snake
    const next = step(run, "left")
    expect(next.direction).toBe("right")
    expect(next.snake[0]?.x).toBe((head?.x ?? 0) + 1)
    expect(next.over).toBe(false)
  })

  test("the wall ends the run", () => {
    let run = initialRun(3)
    const stepsToTheEdge = COLS - 1 - (run.snake[0]?.x ?? 0)
    for (const _unused of Array.from({ length: stepsToTheEdge })) {
      run = step(run)
    }
    expect(run.over).toBe(false)
    expect(step(run).over).toBe(true)
  })

  test("your own body ends the run", () => {
    // A four-segment snake curled so that turning down runs into its own tail.
    const run: Run = {
      direction: "right",
      food: { x: 0, y: 0 },
      over: false,
      score: 0,
      seed: 1,
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 4, y: 6 },
        { x: 5, y: 6 },
        { x: 6, y: 6 },
      ],
    }
    expect(step(run, "down").over).toBe(true)
  })

  test("eating grows the tail and moves the head once", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ]
    const run = runFacingRight(snake, { x: 6, y: 5 })
    const next = step(run)
    expect(next.score).toBe(1)
    expect(next.snake).toHaveLength(snake.length + 1)
    expect(next.snake[0]).toEqual({ x: 6, y: 5 })
    expect(next.over).toBe(false)
  })

  test("the tail's cell is free on the tick it vacates", () => {
    // Curled so that turning down puts the head exactly where the tail is —
    // legal, because the tail leaves that cell on this same tick.
    const run: Run = {
      direction: "left",
      food: { x: 0, y: 0 },
      over: false,
      score: 0,
      seed: 1,
      snake: [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 6, y: 6 },
        { x: 5, y: 6 },
      ],
    }
    expect(step(run, "down").over).toBe(false)
  })

  test("the board is the size the UI draws", () => {
    expect(COLS).toBe(20)
    expect(ROWS).toBe(14)
  })
})
