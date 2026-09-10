import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { startHub, type Hub } from "../src/hub.ts";
import { Store } from "../src/state.ts";
import type { ServerMessage } from "../src/types.ts";

let hub: Hub;
const store = new Store();
const token = "tok123";

beforeAll(() => {
  hub = startHub({ store, token, distDir: resolve(import.meta.dir, "../ui/dist") });
});
afterAll(() => hub.stop());

describe("hub", () => {
  test("refuses requests without token", async () => {
    const res = await fetch(`http://127.0.0.1:${hub.port}/`);
    expect(res.status).toBe(403);
  });

  test("serves index with token and sets cookie; cookie then authorizes", async () => {
    const res = await fetch(`http://127.0.0.1:${hub.port}/?token=${token}`);
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("grill_token=tok123");
    expect(cookie).toContain("HttpOnly");
    const res2 = await fetch(`http://127.0.0.1:${hub.port}/api/sessions`, { headers: { cookie: "grill_token=tok123" } });
    expect(res2.status).toBe(200);
    const bad = await fetch(`http://127.0.0.1:${hub.port}/api/sessions`, { headers: { cookie: "grill_token=wrong" } });
    expect(bad.status).toBe(403);
  });

  test("ws relays state and applies answers", async () => {
    const sess = store.createSession("ws");
    const round = store.addRound(sess.id, [{ title: "A", body: "a?", options: [{ label: "x" }], recommendation: "x" }]);
    const ws = new WebSocket(`ws://127.0.0.1:${hub.port}/ws?session=${sess.id}&token=${token}`);
    const messages: ServerMessage[] = [];
    const next = () =>
      new Promise<ServerMessage>((res) => {
        ws.addEventListener("message", (ev) => res(JSON.parse(ev.data as string)), { once: true });
      });
    await new Promise((r) => ws.addEventListener("open", r, { once: true }));
    const first = await next();
    expect(first.type).toBe("state");
    if (first.type === "state") expect(first.session.clients).toBe(1);

    const p = next();
    ws.send(JSON.stringify({ type: "answer", roundId: round.id, questionId: "r1q1", answer: { kind: "option", optionId: "a", text: "" } }));
    const after = await p;
    expect(after.type === "state" && after.session.rounds[0]!.answers.r1q1?.text).toBe("x");

    const pe = next();
    ws.send("not json");
    expect((await pe).type).toBe("error");

    ws.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(store.get(sess.id).clients).toBe(0);
    void messages;
  });

  test("ws refuses unknown session", async () => {
    const res = await fetch(`http://127.0.0.1:${hub.port}/ws?session=nope&token=${token}`);
    expect(res.status).toBe(404);
  });
});
