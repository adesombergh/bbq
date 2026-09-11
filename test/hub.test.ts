import type { Hub } from "../src/hub.ts"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import path from "node:path"

import { z } from "zod"

import { startHub } from "../src/hub.ts"
import { Store } from "../src/state.ts"

/** Just enough of ServerMessage for these assertions. */
const serverMessageSchema = z.discriminatedUnion("type", [
  z.object({
    session: z.object({
      rounds: z.array(
        z.object({
          answers: z.record(z.string(), z.object({ text: z.string() })),
        })
      ),
      tabs: z.number(),
    }),
    type: z.literal("state"),
  }),
  z.object({ message: z.string(), type: z.literal("error") }),
])
type LooseServerMessage = z.infer<typeof serverMessageSchema>

const CLOSE_SETTLE_MS = 50

let hub: Hub
const store = new Store()
const token = "tok123"

beforeAll(() => {
  hub = startHub({
    distDir: path.resolve(import.meta.dir, "../ui/dist"),
    store,
    token,
  })
})
afterAll(() => {
  hub.stop()
})

async function nextMessage(ws: WebSocket): Promise<LooseServerMessage> {
  const { promise, resolve } = Promise.withResolvers<LooseServerMessage>()
  ws.addEventListener(
    "message",
    (ev) => {
      resolve(serverMessageSchema.parse(JSON.parse(String(ev.data))))
    },
    { once: true }
  )
  return await promise
}

async function opened(ws: WebSocket): Promise<Event> {
  const { promise, resolve } = Promise.withResolvers<Event>()
  ws.addEventListener("open", resolve, { once: true })
  return await promise
}

describe("hub", () => {
  test("refuses requests without token", async () => {
    const res = await fetch(`http://127.0.0.1:${hub.port}/`)
    expect(res.status).toBe(403)
  })

  test("serves index with token and sets cookie; cookie then authorizes", async () => {
    const res = await fetch(`http://127.0.0.1:${hub.port}/?token=${token}`)
    expect(res.status).toBe(200)
    const cookie = res.headers.get("set-cookie") ?? ""
    expect(cookie).toContain("bbq_token=tok123")
    expect(cookie).toContain("HttpOnly")
    const res2 = await fetch(`http://127.0.0.1:${hub.port}/api/sessions`, {
      headers: { cookie: "bbq_token=tok123" },
    })
    expect(res2.status).toBe(200)
    const bad = await fetch(`http://127.0.0.1:${hub.port}/api/sessions`, {
      headers: { cookie: "bbq_token=wrong" },
    })
    expect(bad.status).toBe(403)
  })

  test("ws relays state and applies answers", async () => {
    const sess = store.createSession("ws")
    const round = store.addRound(sess.id, [
      {
        body: "a?",
        options: [{ label: "x" }],
        recommendation: "x",
        title: "A",
      },
    ])
    const ws = new WebSocket(
      `ws://127.0.0.1:${hub.port}/ws?session=${sess.id}&token=${token}`
    )
    await opened(ws)
    const first = await nextMessage(ws)
    expect(first.type).toBe("state")
    if (first.type === "state") {
      expect(first.session.tabs).toBe(1)
    }

    const afterAnswer = nextMessage(ws)
    ws.send(
      JSON.stringify({
        answer: { kind: "option", optionId: "a", text: "" },
        questionId: "r1q1",
        roundId: round.id,
        type: "answer",
      })
    )
    const after = await afterAnswer
    expect(
      after.type === "state" && after.session.rounds[0]?.answers.r1q1?.text
    ).toBe("x")

    const afterGarbage = nextMessage(ws)
    ws.send("not json")
    const errorMessage = await afterGarbage
    expect(errorMessage.type).toBe("error")

    ws.close()
    await Bun.sleep(CLOSE_SETTLE_MS)
    expect(store.get(sess.id).tabs).toBe(0)
  })

  test("ws refuses unknown session", async () => {
    const res = await fetch(
      `http://127.0.0.1:${hub.port}/ws?session=nope&token=${token}`
    )
    expect(res.status).toBe(404)
  })
})
