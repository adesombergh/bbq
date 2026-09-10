import type { Answer, AsideKind, ClientMessage, Session } from "@shared/types"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { sessionKey, sessionQueryOptions } from "./session-query"
import { getConnection } from "./session-socket"

/** Apply a client message to a session snapshot the way the hub will. */
function optimistic(session: Session, message: ClientMessage): Session {
  if (message.type !== "answer" && message.type !== "submit_round") {
    return session
  }
  return {
    ...session,
    rounds: session.rounds.map((round) => {
      if (round.id !== message.roundId) {
        return round
      }
      if (message.type === "submit_round") {
        return { ...round, status: "submitted", submittedAt: Date.now() }
      }
      const answer: Answer = { ...message.answer, answeredAt: Date.now() }
      return {
        ...round,
        answers: { ...round.answers, [message.questionId]: answer },
      }
    }),
  }
}

/**
 * Every browser -> hub message goes through this mutation: it sends on the
 * socket and patches the cache optimistically; the hub's next `state` frame
 * (or a refetch on failure) is the source of truth.
 */
export function useSendMessage(sessionId: string) {
  const queryClient = useQueryClient()
  const key = sessionKey(sessionId)
  return useMutation({
    mutationFn: async (message: ClientMessage) => {
      await getConnection(sessionId).send(message)
    },
    onError: async () => {
      await queryClient.refetchQueries(sessionQueryOptions(sessionId))
    },
    onMutate: (message) => {
      queryClient.setQueryData<Session>(key, (current) =>
        current ? optimistic(current, message) : current
      )
    },
  })
}

export type SendMessage = ReturnType<typeof useSendMessage>["mutate"]

export const messages = {
  answer: (
    roundId: string,
    questionId: string,
    answer: Omit<Answer, "answeredAt">
  ): ClientMessage => ({ answer, questionId, roundId, type: "answer" }),
  requestAside: (
    roundId: string,
    questionId: string,
    kind: AsideKind
  ): ClientMessage => ({ kind, questionId, roundId, type: "request_aside" }),
  submitRound: (roundId: string): ClientMessage => ({
    roundId,
    type: "submit_round",
  }),
}
