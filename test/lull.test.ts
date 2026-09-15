import { describe, expect, test } from "bun:test"

import { sleep } from "bun"

import {
  getLullSettled,
  lullGraceMs,
  subscribeLullSettled,
} from "../ui/src/lib/lull"

describe("the lull's grace", () => {
  test("a lull is unsettled until the grace has passed", async () => {
    const unsubscribe = subscribeLullSettled(() => {
      // The board would re-render here; the test reads the snapshot instead.
    })

    expect(getLullSettled()).toBe(false)
    await sleep(lullGraceMs + 50)
    expect(getLullSettled()).toBe(true)

    unsubscribe()
  })

  test("the next lull waits out its own grace", async () => {
    const unsubscribe = subscribeLullSettled(() => {
      // As above.
    })
    await sleep(lullGraceMs + 50)
    expect(getLullSettled()).toBe(true)
    unsubscribe()

    expect(getLullSettled()).toBe(false)
  })

  test("a lull that ends before the grace never settles", async () => {
    let notified = 0
    const unsubscribe = subscribeLullSettled(() => {
      notified += 1
    })
    unsubscribe()

    await sleep(lullGraceMs + 50)
    expect(notified).toBe(0)
    expect(getLullSettled()).toBe(false)
  })
})
