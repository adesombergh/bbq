import type { AsideKind, Session } from "@shared/types"

import { useSuspenseQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useSelector } from "@tanstack/react-store"

import { AlertTriangle } from "lucide-react"
import { useDefaultLayout } from "react-resizable-panels"

import { AsidePanel } from "@/components/aside-panel"
import { Debrief } from "@/components/debrief"
import { NoteBubble } from "@/components/note-bubble"
import { PastimeBoard } from "@/components/pastime-board"
import { RoundView } from "@/components/round-view"
import { SessionHeader } from "@/components/session-header"
import { Alert, AlertTitle } from "@/components/ui/alert"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  activePick,
  activeQuestionId,
  asidesFor,
  findQuestion,
  newestAside,
  openRound,
  panelQuestionId,
  panelTab,
  timeline,
} from "@/lib/derive"
import { messages, useSendMessage } from "@/lib/session-mutations"
import { sessionQueryOptions } from "@/lib/session-query"
import { getConnection } from "@/lib/session-socket"

const route = getRouteApi("/s/$sessionId")

/** React 19 ref callback: the newest timeline item scrolls itself into view when it mounts. */
const scrollIntoView = (node: HTMLDivElement | null): void => {
  node?.scrollIntoView({ behavior: "smooth", block: "end" })
}

/**
 * A lull: no round is open, so nothing is expected of the person. The line says
 * what we are waiting for and the pastime is there to pass the time.
 */
const Lull = ({ message }: { message: string }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="inline-block size-2 animate-pulse rounded-full bg-primary" />
      {message}
    </div>
    <PastimeBoard />
  </div>
)

const SessionFooter = ({ session }: { session: Session }) => {
  if (session.status === "closed") {
    return <Debrief session={session} />
  }
  if (openRound(session) === undefined && session.rounds.length > 0) {
    return <Lull message="Claude is thinking about the next round…" />
  }
  return null
}

export const SessionPage = () => {
  const { sessionId } = route.useParams()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { data: session } = useSuspenseQuery(sessionQueryOptions(sessionId))
  const connection = getConnection(sessionId)
  const status = useSelector(connection.store, (state) => state.status)
  const error = useSelector(connection.store, (state) => state.error)
  const { mutate: send } = useSendMessage(sessionId)
  const layout = useDefaultLayout({ id: "bbq-layout" })
  const handleLayoutChanged = layout.onLayoutChanged

  const setSearch = (patch: Partial<typeof search>): void => {
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, ...patch }),
    })
  }

  const items = timeline(session)
  const activeQ = activeQuestionId(session, search)
  const pick = activePick(session, search)
  const panelQ = panelQuestionId(session, search)
  const panelTarget =
    panelQ === undefined ? undefined : findQuestion(session, panelQ)
  const panelAsides = panelQ === undefined ? [] : asidesFor(session, panelQ)

  const closePanel = (): void => {
    setSearch({
      dismissed: newestAside(session.asides)?.id,
      panel: undefined,
      tab: undefined,
    })
  }

  const requestAside = (
    roundId: string,
    questionId: string,
    kind: AsideKind
  ): void => {
    send(messages.requestAside(roundId, questionId, kind))
    setSearch({ panel: questionId, tab: kind })
  }

  return (
    <div className="flex h-full flex-col">
      <SessionHeader session={session} status={status} />
      {error === null ? null : (
        <Alert
          className="rounded-none border-x-0 border-t-0"
          variant="destructive"
        >
          <AlertTriangle />
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}
      <ResizablePanelGroup
        className="min-h-0 flex-1"
        defaultLayout={layout.defaultLayout}
        id="bbq-layout"
        onLayoutChanged={handleLayoutChanged}
        orientation="horizontal"
      >
        <ResizablePanel defaultSize="55" id="timeline" minSize="35">
          <ScrollArea className="h-full">
            <main className="mx-auto max-w-3xl space-y-8 px-4 py-6">
              {items.length === 0 && session.status !== "closed" ? (
                <div className="py-12">
                  <Lull message="Waiting for Claude’s first round…" />
                </div>
              ) : null}
              {items.map((item, index) => (
                <div
                  key={item.id}
                  ref={index === items.length - 1 ? scrollIntoView : undefined}
                >
                  {item.kind === "note" ? (
                    <NoteBubble markdown={item.note.markdown} />
                  ) : (
                    <RoundView
                      activeQuestionId={activeQ}
                      asides={session.asides}
                      onActivate={(questionId) => {
                        // A pick belongs to the question you are looking at:
                        // leaving forgets it (ADR 0017).
                        setSearch({ pick: undefined, q: questionId })
                      }}
                      onAnswer={(questionId, answer) => {
                        send(messages.answer(item.round.id, questionId, answer))
                        // Advance to the next unanswered question; when none is
                        // left, dropping `q` collapses every card.
                        const next = item.round.questions.find(
                          (q) =>
                            q.id !== questionId &&
                            item.round.answers[q.id] === undefined
                        )
                        setSearch({ pick: undefined, q: next?.id })
                      }}
                      onAside={(questionId, kind) => {
                        requestAside(item.round.id, questionId, kind)
                      }}
                      onOpenPanel={(questionId) => {
                        setSearch({ panel: questionId })
                      }}
                      onPick={(questionId, picked) => {
                        setSearch({ pick: picked, q: questionId })
                      }}
                      onSubmit={() => {
                        send(messages.submitRound(item.round.id))
                      }}
                      panelQuestionId={panelQ}
                      pick={pick}
                      round={item.round}
                      sessionKind={session.kind}
                    />
                  )}
                </div>
              ))}
              <SessionFooter session={session} />
            </main>
          </ScrollArea>
        </ResizablePanel>
        {panelTarget ? (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="45" id="aside" minSize="25">
              <AsidePanel
                asides={panelAsides}
                onClose={closePanel}
                onRequest={(kind) => {
                  requestAside(
                    panelTarget.round.id,
                    panelTarget.question.id,
                    kind
                  )
                }}
                onTabChange={(kind) => {
                  setSearch({ tab: kind })
                }}
                question={panelTarget.question}
                round={panelTarget.round}
                tab={panelTab(panelAsides, search)}
              />
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>
    </div>
  )
}
