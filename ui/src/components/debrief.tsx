import type { Session } from "@shared/types"

import { useSyncExternalStore } from "react"

import { Separator } from "@/components/ui/separator"
import { getAway, subscribeAway } from "@/lib/away"
import { getPastime, subscribePastimeTotals } from "@/lib/pastime/store"
import {
  awayWithin,
  debrief,
  formatDuration,
  percent,
  sawWholeSession,
} from "@/lib/session-stats"

const Tile = ({
  detail,
  label,
  value,
}: {
  detail?: string
  label: string
  value: string
}) => (
  <div className="rounded-md bg-background/60 px-3 py-2">
    <div className="text-xl text-foreground tabular-nums">{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
    {detail === undefined ? null : (
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    )}
  </div>
)

/** A number the sentence is built around, so the eye finds it first. */
const N = ({ children }: { children: string }) => (
  <span className="font-medium text-foreground tabular-nums">{children}</span>
)

const plural = (count: number, one: string, many: string): string =>
  count === 1 ? one : many

const TakeRate = ({
  questions,
  taken,
}: {
  questions: number
  taken: number
}) =>
  questions === 0 ? null : (
    <li>
      You took the recommendation on <N>{`${taken} of ${questions}`}</N>{" "}
      {plural(questions, "question", "questions")} —{" "}
      <N>{`${percent(taken, questions)}%`}</N>.
    </li>
  )

const ManualAnswers = ({
  manual,
  questions,
}: {
  manual: number
  questions: number
}) => {
  if (questions === 0) {
    return null
  }
  if (manual === 0) {
    return <li>Every answer was one of the options on offer.</li>
  }
  return (
    <li>
      No option fit <N>{`${manual} ${plural(manual, "time", "times")}`}</N>, so
      you wrote the answer yourself.
    </li>
  )
}

const Asides = ({ asides }: { asides: number }) =>
  asides === 0 ? (
    <li>You asked for no asides.</li>
  ) : (
    <li>
      You asked Claude to explain itself again{" "}
      <N>{`${asides} ${plural(asides, "time", "times")}`}</N>.
    </li>
  )

/**
 * The block of numbers this page watched happen rather than derived. It is
 * shown only when the tab has been open since the session started: a share of
 * a session the page did not see is worse than no share, and nothing in the
 * rendering would let the reader tell.
 */
const WhileTheTabWasOpen = ({
  elapsedMs,
  session,
}: {
  elapsedMs: number
  session: Session
}) => {
  const { openedAt, spans } = useSyncExternalStore(subscribeAway, getAway)
  const { playedMs } = useSyncExternalStore(subscribePastimeTotals, getPastime)

  if (!sawWholeSession(session, openedAt)) {
    return null
  }

  // Only the stretches inside the session itself: the tab is meant to be kept
  // afterwards, and an afternoon away from a finished session is not away.
  const awayMs = awayWithin(
    spans,
    session.createdAt,
    session.closedAt ?? session.createdAt
  )

  return (
    <>
      <Separator />
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">
          While you had this tab open
        </div>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            Away from this tab for <N>{formatDuration(awayMs)}</N> —{" "}
            <N>{`${percent(awayMs, elapsedMs)}%`}</N> of the session.
          </li>
          <li>
            On the pastime for <N>{formatDuration(playedMs)}</N> —{" "}
            <N>{`${percent(playedMs, elapsedMs)}%`}</N>.
          </li>
        </ul>
      </div>
    </>
  )
}

/**
 * The debrief: what a session shows once it is closed. A record rather than a
 * scoreboard — the numbers were chosen because they say something about the
 * session, not because they flatter. The pastime is the tab's fun; this is the
 * other end of it.
 */
export const Debrief = ({ session }: { session: Session }) => {
  const stats = debrief(session)

  return (
    <div className="space-y-4 rounded-lg border bg-secondary p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Tile
          label={plural(stats.rounds, "round", "rounds")}
          value={String(stats.rounds)}
        />
        <Tile
          label={plural(stats.questions, "question", "questions")}
          value={String(stats.questions)}
        />
        <Tile
          detail={`${formatDuration(stats.roundOpenMs)} with a question in front of you`}
          label="elapsed"
          value={formatDuration(stats.elapsedMs)}
        />
      </div>
      <ul className="space-y-1 text-muted-foreground text-sm">
        <TakeRate
          questions={stats.questions}
          taken={stats.recommendationTaken}
        />
        <ManualAnswers
          manual={stats.manualAnswers}
          questions={stats.questions}
        />
        <Asides asides={stats.asides} />
      </ul>
      <WhileTheTabWasOpen elapsedMs={stats.elapsedMs} session={session} />
      <Separator />
      <p className="text-center text-muted-foreground text-xs">
        Session closed. You can keep this tab for reference.
      </p>
    </div>
  )
}
