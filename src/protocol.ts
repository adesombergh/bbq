/**
 * Runtime validation of what a browser may send over the WebSocket. The
 * TypeScript union in types.ts is the contract; this schema enforces it at
 * the edge so the Store only ever sees well-formed messages.
 */
import type { ClientMessage } from "./types.ts"

import { z } from "zod"

import { ASIDE_KINDS } from "./types.ts"

const answerSchema = z.object({
  kind: z.enum(["option", "text", "recommended"]),
  optionId: z.string().optional(),
  text: z.string(),
})

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    answer: answerSchema,
    questionId: z.string(),
    roundId: z.string(),
    type: z.literal("answer"),
  }),
  z.object({
    questionId: z.string(),
    roundId: z.string(),
    type: z.literal("clear_answer"),
  }),
  z.object({ roundId: z.string(), type: z.literal("submit_round") }),
  z.object({
    kind: z.enum(ASIDE_KINDS),
    questionId: z.string(),
    roundId: z.string(),
    type: z.literal("request_aside"),
  }),
])

export type ParsedClientMessage =
  | { ok: true; message: ClientMessage }
  | { ok: false; error: string }

/** Parse a raw WebSocket frame into a ClientMessage, or explain why not. */
export function parseClientMessage(raw: string): ParsedClientMessage {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { error: "Malformed JSON", ok: false }
  }
  const result = clientMessageSchema.safeParse(json)
  if (!result.success) {
    return { error: `Invalid message: ${result.error.message}`, ok: false }
  }
  return { message: result.data, ok: true }
}
