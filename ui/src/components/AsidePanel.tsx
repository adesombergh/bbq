import { useEffect, useMemo, useState } from "react";
import type { Aside, AsideKind, Question, Round } from "../../../src/types.ts";
import { Md } from "../markdown.tsx";

const LABELS: Record<AsideKind, string> = { "wait-what": "Wait, what?", "show-me": "Show me", eli5: "ELI5" };
const ORDER: AsideKind[] = ["wait-what", "show-me", "eli5"];

interface Props {
  question: Question;
  round: Round;
  asides: Aside[];
  onClose: () => void;
  onRequest: (kind: AsideKind) => void;
}

export function AsidePanel({ question, round, asides, onClose, onRequest }: Props) {
  const byKind = useMemo(() => {
    const m = new Map<AsideKind, Aside>();
    for (const a of asides) m.set(a.kind, a); // latest wins
    return m;
  }, [asides]);
  const kinds = ORDER.filter((k) => byKind.has(k));
  const [tab, setTab] = useState<AsideKind | null>(kinds[kinds.length - 1] ?? null);

  // Follow the newest aside as they arrive.
  useEffect(() => {
    const newest = asides.reduce<Aside | null>((acc, a) => (!acc || a.requestedAt > acc.requestedAt ? a : acc), null);
    if (newest) setTab(newest.kind);
  }, [asides.length, asides.map((a) => a.status).join()]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const current = tab ? byKind.get(tab) : undefined;
  const qIndex = round.questions.findIndex((q) => q.id === question.id) + 1;

  return (
    <aside className="w-[46%] max-w-3xl min-w-[22rem] shrink-0 border-l border-line bg-panel flex flex-col">
      <div className="px-4 py-3 border-b border-line flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-widest text-info">Context · Round {round.index} · Q{qIndex}</div>
          <div className="font-semibold truncate">{question.title}</div>
        </div>
        <button onClick={onClose} title="Close (Esc)" className="text-muted hover:text-ink text-xl leading-none px-1">
          ×
        </button>
      </div>

      <div className="px-4 pt-3 flex gap-1 flex-wrap">
        {ORDER.map((k) => {
          const a = byKind.get(k);
          const isTab = tab === k;
          return (
            <button
              key={k}
              onClick={() => (a ? setTab(k) : onRequest(k))}
              className={`rounded-md px-3 py-1.5 text-sm border transition ${
                isTab ? "border-info bg-info/10 text-ink" : "border-line text-muted hover:text-ink"
              }`}
            >
              {LABELS[k]}
              {a && a.status !== "resolved" && a.status !== "failed" && (
                <span className="ml-1.5 inline-block size-1.5 rounded-full bg-info animate-pulse align-middle" />
              )}
              {!a && <span className="ml-1 text-xs opacity-60">+</span>}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {!current ? (
          <p className="text-sm text-muted">Pick a button above to ask Claude for an aside about this question.</p>
        ) : (
          <AsideBody aside={current} />
        )}
      </div>
    </aside>
  );
}

function AsideBody({ aside }: { aside: Aside }) {
  if (aside.status === "requested" || aside.status === "claimed") {
    return (
      <div className="flex items-center gap-3 text-muted text-sm py-8 justify-center">
        <span className="inline-block size-2.5 rounded-full bg-info animate-pulse" />
        {aside.status === "requested" ? "Sent to Claude, waiting for it to pick this up…" : "Claude is working on it…"}
      </div>
    );
  }
  if (aside.status === "failed") {
    return <div className="text-sm text-red-300">Claude could not produce this: {aside.error}</div>;
  }
  if (aside.format === "html") return <HtmlFrame html={aside.content ?? ""} />;
  return <Md text={aside.content ?? ""} className="text-[15px]" />;
}

/** Sandboxed frame for Claude-produced HTML (SVG diagrams etc.). No scripts run. */
function HtmlFrame({ html }: { html: string }) {
  const [height, setHeight] = useState(400);
  const doc = useMemo(
    () =>
      `<!doctype html><meta charset="utf-8"><style>
        html{color-scheme:dark}html,body{margin:0;background:transparent;color:#e6e8ee;font:15px/1.5 system-ui,sans-serif}
        body{padding:4px} img,svg{max-width:100%} table{border-collapse:collapse} td,th{border:1px solid #2a2f3a;padding:.3em .6em}
        a{color:#60a5fa}
      </style><body>${html}</body>`,
    [html],
  );
  return (
    <iframe
      title="visual"
      sandbox="allow-same-origin"
      srcDoc={doc}
      style={{ height }}
      onLoad={(e) => {
        // allow-same-origin (no scripts) lets us read the height to auto-size the frame.

        try {
          const h = (e.target as HTMLIFrameElement).contentDocument?.body?.scrollHeight;
          if (h) setHeight(Math.min(4000, h + 16));
        } catch {
          /* sandboxed: keep default */
        }
      }}
      className="w-full rounded-lg border border-line bg-bg min-h-[400px]"
    />
  );
}
