import { useEffect, useState } from "react";
import type { Answer, Aside, AsideKind, Question } from "../../../src/types.ts";
import { Md } from "../markdown.tsx";

interface Props {
  index: number;
  question: Question;
  answer?: Answer;
  active: boolean;
  unlocked: boolean;
  roundOpen: boolean;
  highlighted: boolean;
  asides: Aside[];
  onActivate: () => void;
  onAnswer: (a: Omit<Answer, "answeredAt">) => void;
  onAside: (kind: AsideKind) => void;
  onOpenPanel: () => void;
}

const ASIDE_BUTTONS: { kind: AsideKind; label: string; hint: string }[] = [
  { kind: "wait-what", label: "Wait, what?", hint: "Re-pitch this question in plain words" },
  { kind: "show-me", label: "Show me", hint: "Draw it: a visual of the options" },
  { kind: "eli5", label: "ELI5", hint: "Explain like I'm five" },
];

export function QuestionCard(props: Props) {
  const { index, question: q, answer, active, unlocked, roundOpen, highlighted, asides } = props;

  if (!active) return <CollapsedCard {...props} />;

  return (
    <article
      className={`rounded-xl border bg-card shadow-lg shadow-black/30 ${highlighted ? "border-info/60" : "border-accent/60"}`}
    >
      {/* Question */}
      <Section label={`Question ${index}`} tone="accent">
        <h2 className="text-lg font-semibold leading-snug">{q.title}</h2>
        <Md text={q.body} className="mt-2 text-[15px]" />
      </Section>

      {/* Options */}
      <Section label={q.options.length ? "Options" : "Open question"}>
        {q.options.length ? (
          <div className="grid gap-2">
            {q.options.map((o) => {
              const chosen = answer?.optionId === o.id;
              const rec = q.recommendedOptionId === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => props.onAnswer({ kind: "option", optionId: o.id, text: o.label })}
                  className={`text-left rounded-lg border px-3 py-2.5 transition ${
                    chosen
                      ? "border-ok bg-ok/10"
                      : "border-line bg-panel hover:border-muted"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`shrink-0 mt-0.5 size-6 rounded-md grid place-items-center text-xs font-mono ${
                        chosen ? "bg-ok text-black" : "bg-line text-muted"
                      }`}
                    >
                      {o.id}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {o.label}
                        {rec && <span className="text-[10px] uppercase tracking-wide text-accent">recommended</span>}
                      </div>
                      {o.description && <Md text={o.description} className="text-sm text-muted mt-0.5" />}
                    </div>
                    {chosen && <span className="text-ok">✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">No fixed options. Go with the recommendation or write your own answer.</p>
        )}
        <ManualAnswer answer={answer} onAnswer={props.onAnswer} />
      </Section>

      {/* Recommendation */}
      <Section label="Claude recommends" tone="accent" last>
        <div className="flex gap-3">
          <span className="text-accent text-lg leading-none mt-0.5">➡️</span>
          <Md text={q.recommendation} className="flex-1 text-[15px]" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => props.onAnswer({ kind: "recommended", text: q.recommendation })}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
              answer?.kind === "recommended"
                ? "bg-ok text-black"
                : "bg-accent text-black hover:brightness-110"
            }`}
          >
            {answer?.kind === "recommended" ? "✓ Going with recommendation" : "Go with recommendation"}
          </button>
          <span className="flex-1" />
          {ASIDE_BUTTONS.map((b) => {
            const pending = asides.some((a) => a.kind === b.kind && (a.status === "requested" || a.status === "claimed"));
            const done = asides.some((a) => a.kind === b.kind && a.status === "resolved");
            return (
              <button
                key={b.kind}
                title={b.hint}
                onClick={() => (done && !pending ? props.onOpenPanel() : props.onAside(b.kind))}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  pending
                    ? "border-info/60 text-info animate-pulse"
                    : done
                      ? "border-info/40 text-info hover:bg-info/10"
                      : "border-line text-ink hover:border-muted"
                }`}
              >
                {b.label}
                {done && !pending && <span className="ml-1 text-xs">↗</span>}
              </button>
            );
          })}
        </div>
      </Section>

      {answer && (
        <div className="border-t border-line px-4 py-2.5 text-sm flex items-center gap-2 bg-ok/5 rounded-b-xl">
          <span className="text-ok">✓</span>
          <span className="text-muted">Your answer:</span>
          <span className="font-medium truncate">{answer.text}</span>
          {!roundOpen && <span className="ml-auto text-xs text-muted">sent</span>}
        </div>
      )}
      {!unlocked && <div className="hidden">{/* unreachable: active implies unlocked */}</div>}
    </article>
  );
}

function CollapsedCard({ index, question: q, answer, unlocked, roundOpen, highlighted, asides, onActivate, onOpenPanel }: Props) {
  const clickable = roundOpen && unlocked;
  const hasAsides = asides.length > 0;
  return (
    <div
      role={clickable ? "button" : undefined}
      onClick={clickable ? onActivate : undefined}
      className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
        highlighted ? "border-info/60" : "border-line"
      } ${clickable ? "bg-panel hover:border-muted cursor-pointer" : "bg-panel/50"}`}
    >
      <span
        className={`shrink-0 mt-0.5 size-6 rounded-md grid place-items-center text-xs font-mono ${
          answer ? "bg-ok/20 text-ok" : unlocked ? "bg-accent/20 text-accent" : "bg-line text-muted"
        }`}
      >
        {answer ? "✓" : index}
      </span>
      <div className="min-w-0 flex-1">
        <div className={`font-medium ${!unlocked && !answer ? "text-muted" : ""}`}>{q.title}</div>
        {answer ? (
          <div className="text-sm text-muted truncate">
            {answer.kind === "recommended" ? "Recommendation: " : ""}
            {answer.text}
          </div>
        ) : (
          <div className="text-sm text-muted">{unlocked ? (roundOpen ? "Up next — click to answer" : "") : "Locked until the previous question is answered"}</div>
        )}
      </div>
      {hasAsides && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenPanel();
          }}
          className="shrink-0 text-xs text-info hover:underline"
        >
          {asides.length} aside{asides.length > 1 ? "s" : ""} ↗
        </button>
      )}
      {answer && roundOpen && <span className="shrink-0 text-xs text-muted">change</span>}
    </div>
  );
}

function Section({ label, tone, last, children }: { label: string; tone?: "accent"; last?: boolean; children: React.ReactNode }) {
  return (
    <div className={`px-4 py-4 ${last ? "" : "border-b border-line"}`}>
      <div className={`text-[11px] uppercase tracking-widest mb-2 ${tone === "accent" ? "text-accent" : "text-muted"}`}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ManualAnswer({ answer, onAnswer }: { answer?: Answer; onAnswer: (a: Omit<Answer, "answeredAt">) => void }) {
  const [open, setOpen] = useState(answer?.kind === "text");
  const [draft, setDraft] = useState(answer?.kind === "text" ? answer.text : "");
  useEffect(() => {
    if (answer?.kind === "text") {
      setOpen(true);
      setDraft(answer.text);
    }
  }, [answer?.kind, answer?.text]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-3 text-sm text-muted hover:text-ink underline underline-offset-4">
        Enter a manual answer…
      </button>
    );
  }
  const dirty = draft.trim() && draft.trim() !== (answer?.kind === "text" ? answer.text : "");
  return (
    <div className="mt-3 space-y-2">
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && dirty) onAnswer({ kind: "text", text: draft.trim() });
        }}
        rows={4}
        placeholder="Write your full answer. ⌘/Ctrl+Enter to save."
        className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm focus:outline-none focus:border-accent"
      />
      <div className="flex gap-2">
        <button
          disabled={!dirty}
          onClick={() => onAnswer({ kind: "text", text: draft.trim() })}
          className="rounded-lg bg-ink text-bg px-3 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          {answer?.kind === "text" ? "Update answer" : "Save answer"}
        </button>
        <button onClick={() => setOpen(false)} className="text-sm text-muted hover:text-ink px-2">
          Close
        </button>
      </div>
    </div>
  );
}
