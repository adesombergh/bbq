import { useEffect, useMemo, useState } from "react";
import type { Aside, AsideKind, Round } from "../../src/types.ts";
import { AsidePanel } from "./components/AsidePanel.tsx";
import { Header } from "./components/Header.tsx";
import { NoteBubble } from "./components/NoteBubble.tsx";
import { RoundView } from "./components/RoundView.tsx";
import { useSession } from "./ws.ts";

function sessionIdFromUrl(): string | null {
  const m = location.pathname.match(/^\/s\/([^/]+)/);
  return m?.[1] ?? new URLSearchParams(location.search).get("session");
}

export function App() {
  const sessionId = sessionIdFromUrl();
  if (!sessionId) return <NoSession />;
  return <SessionApp sessionId={sessionId} />;
}

function NoSession() {
  return (
    <div className="h-full grid place-items-center text-muted">
      <div className="max-w-md text-center space-y-2">
        <div className="text-3xl">🔥</div>
        <p>No session in the URL. Ask Claude to call <code>open_session</code>; it opens the right link.</p>
      </div>
    </div>
  );
}

function SessionApp({ sessionId }: { sessionId: string }) {
  const { session, conn, error, send } = useSession(sessionId);
  const [activeQ, setActiveQ] = useState<string | null>(null);
  const [panelQ, setPanelQ] = useState<string | null>(null);
  const [seenAsides, setSeenAsides] = useState<Set<string>>(new Set());

  const openRound: Round | undefined = session?.rounds.find((r) => r.status === "open");

  // Default active question: first unanswered of the open round.
  const firstUnanswered = openRound?.questions.find((q) => !openRound.answers[q.id])?.id ?? null;
  useEffect(() => {
    if (!openRound) return setActiveQ(null);
    const stillValid = activeQ && openRound.questions.some((q) => q.id === activeQ);
    if (!stillValid) setActiveQ(firstUnanswered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRound?.id]);

  // Auto-open the panel when an aside is requested/resolved for a question.
  useEffect(() => {
    if (!session) return;
    const fresh = session.asides.filter((a) => !seenAsides.has(a.id));
    if (fresh.length) {
      setPanelQ(fresh[fresh.length - 1]!.questionId);
      setSeenAsides((s) => new Set([...s, ...fresh.map((a) => a.id)]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.asides.length]);

  // Auto-scroll to the newest round / note.
  const itemCount = (session?.rounds.length ?? 0) + (session?.notes.length ?? 0);
  useEffect(() => {
    document.getElementById("chat-end")?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [itemCount]);

  const timeline = useMemo(() => {
    if (!session) return [];
    const items: ({ kind: "round"; at: number; round: Round } | { kind: "note"; at: number; id: string; md: string })[] = [
      ...session.rounds.map((round) => ({ kind: "round" as const, at: round.createdAt, round })),
      ...session.notes.map((n) => ({ kind: "note" as const, at: n.createdAt, id: n.id, md: n.markdown })),
    ];
    return items.sort((a, b) => a.at - b.at);
  }, [session]);

  const requestAside = (roundId: string, questionId: string, kind: AsideKind) => {
    send({ type: "request_aside", roundId, questionId, kind });
    setPanelQ(questionId);
  };

  const panelAsides: Aside[] = session?.asides.filter((a) => a.questionId === panelQ) ?? [];
  const panelQuestion = session?.rounds.flatMap((r) => r.questions).find((q) => q.id === panelQ);
  const panelRound = session?.rounds.find((r) => r.questions.some((q) => q.id === panelQ));

  if (!session) {
    return (
      <div className="h-full grid place-items-center text-muted">
        {conn === "connecting" ? "Connecting…" : "Hub unreachable. Is the MCP server still running?"}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Header session={session} conn={conn} />
      {error && (
        <div className="bg-red-900/60 text-red-100 text-sm px-4 py-2 border-b border-red-800">{error}</div>
      )}
      <div className="flex-1 min-h-0 flex">
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className={`mx-auto px-4 py-6 space-y-8 ${panelQ ? "max-w-3xl" : "max-w-3xl"}`}>
            {timeline.length === 0 && (
              <p className="text-muted text-center py-20">Waiting for Claude's first round…</p>
            )}
            {timeline.map((item) =>
              item.kind === "note" ? (
                <NoteBubble key={item.id} markdown={item.md} />
              ) : (
                <RoundView
                  key={item.round.id}
                  round={item.round}
                  activeQ={activeQ}
                  panelQ={panelQ}
                  asides={session.asides}
                  onActivate={(qid) => setActiveQ(qid)}
                  onAnswer={(qid, answer) => {
                    send({ type: "answer", roundId: item.round.id, questionId: qid, answer });
                    // Advance to the next unanswered question (none => all collapsed, Send button visible).
                    const next = item.round.questions.find((q) => q.id !== qid && !item.round.answers[q.id]);
                    setActiveQ(next?.id ?? null);
                  }}
                  onSubmit={() => send({ type: "submit_round", roundId: item.round.id })}
                  onAside={(qid, kind) => requestAside(item.round.id, qid, kind)}
                  onOpenPanel={(qid) => setPanelQ(qid)}
                />
              ),
            )}
            {session.status === "open" && !openRound && timeline.length > 0 && (
              <div className="flex items-center gap-2 text-muted text-sm">
                <span className="inline-block size-2 rounded-full bg-accent animate-pulse" />
                Claude is thinking about the next round…
              </div>
            )}
            {session.status === "closed" && (
              <div className="rounded-lg border border-line bg-panel p-4 text-center text-muted">
                Session closed. You can keep this tab for reference.
              </div>
            )}
            <div id="chat-end" />
          </div>
        </main>
        {panelQ && panelQuestion && panelRound && (
          <AsidePanel
            question={panelQuestion}
            round={panelRound}
            asides={panelAsides}
            onClose={() => setPanelQ(null)}
            onRequest={(kind) => requestAside(panelRound.id, panelQuestion.id, kind)}
          />
        )}
      </div>
    </div>
  );
}
