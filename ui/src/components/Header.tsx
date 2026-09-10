import type { Session } from "../../../src/types.ts";
import type { ConnState } from "../ws.ts";

export function Header({ session, conn }: { session: Session; conn: ConnState }) {
  const dot = conn === "open" ? "bg-ok" : conn === "connecting" ? "bg-accent animate-pulse" : "bg-red-500";
  const rounds = session.rounds.length;
  return (
    <header className="shrink-0 border-b border-line bg-panel px-4 py-3 flex items-center gap-3">
      <span className="text-xl">🔥</span>
      <div className="min-w-0 flex-1">
        <h1 className="font-semibold truncate">{session.title}</h1>
        <p className="text-xs text-muted">
          Grilling session · {rounds} round{rounds === 1 ? "" : "s"} · {session.status}
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted" title={`hub connection: ${conn}`}>
        <span className={`inline-block size-2 rounded-full ${dot}`} />
        {conn === "open" ? "live" : conn}
      </div>
    </header>
  );
}
