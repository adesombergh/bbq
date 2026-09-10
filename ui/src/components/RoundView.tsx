import type { Answer, Aside, AsideKind, Round } from "../../../src/types.ts";
import { Md } from "../markdown.tsx";
import { QuestionCard } from "./QuestionCard.tsx";

interface Props {
  round: Round;
  activeQ: string | null;
  panelQ: string | null;
  asides: Aside[];
  onActivate: (questionId: string) => void;
  onAnswer: (questionId: string, answer: Omit<Answer, "answeredAt">) => void;
  onSubmit: () => void;
  onAside: (questionId: string, kind: AsideKind) => void;
  onOpenPanel: (questionId: string) => void;
}

/** Mirrors Store.canAnswer: every earlier question must be answered. */
function canAnswer(round: Round, idx: number): boolean {
  if (round.status !== "open") return false;
  return round.questions.slice(0, idx).every((q) => round.answers[q.id]);
}

export function RoundView({ round, activeQ, panelQ, asides, onActivate, onAnswer, onSubmit, onAside, onOpenPanel }: Props) {
  const answered = round.questions.filter((q) => round.answers[q.id]).length;
  const complete = answered === round.questions.length;
  const open = round.status === "open";

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="font-semibold text-ink">Round {round.index}</span>
        <span>·</span>
        <span>
          {answered}/{round.questions.length} answered
        </span>
        {!open && <span className="ml-auto rounded-full bg-ok/15 text-ok px-2 py-0.5 text-xs">sent to Claude</span>}
      </div>

      {round.intro && (
        <div className="rounded-xl border border-line bg-panel px-4 py-3 text-sm">
          <Md text={round.intro} />
        </div>
      )}

      <div className="space-y-2">
        {round.questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            index={i + 1}
            question={q}
            answer={round.answers[q.id]}
            active={open && activeQ === q.id}
            unlocked={canAnswer(round, i)}
            roundOpen={open}
            highlighted={panelQ === q.id}
            asides={asides.filter((a) => a.questionId === q.id)}
            onActivate={() => onActivate(q.id)}
            onAnswer={(a) => onAnswer(q.id, a)}
            onAside={(kind) => onAside(q.id, kind)}
            onOpenPanel={() => onOpenPanel(q.id)}
          />
        ))}
      </div>

      {open && (
        <div className="flex items-center justify-end gap-3 pt-1">
          {!complete && (
            <span className="text-xs text-muted">Answer every question, then send the round.</span>
          )}
          <button
            className="rounded-lg bg-accent text-black font-semibold px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
            disabled={!complete}
            onClick={onSubmit}
          >
            Send answers to Claude →
          </button>
        </div>
      )}
    </section>
  );
}
