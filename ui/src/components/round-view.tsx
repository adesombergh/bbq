import type { Answer, Aside, AsideKind, Round } from "@shared/types"

import { answeredCount, canAnswer, isComplete } from "@shared/round-rules"
import { ArrowRight } from "lucide-react"

import { Md } from "@/components/md"
import { QuestionCard } from "@/components/question-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface RoundViewProps {
  round: Round
  activeQuestionId: string | undefined
  pick: string | undefined
  panelQuestionId: string | undefined
  asides: Aside[]
  onActivate: (questionId: string) => void
  onPick: (questionId: string, pick: string) => void
  onAnswer: (questionId: string, answer: Omit<Answer, "answeredAt">) => void
  onSubmit: () => void
  onAside: (questionId: string, kind: AsideKind) => void
  onOpenPanel: (questionId: string) => void
}

export const RoundView = ({
  round,
  activeQuestionId,
  pick,
  panelQuestionId,
  asides,
  onActivate,
  onPick,
  onAnswer,
  onSubmit,
  onAside,
  onOpenPanel,
}: RoundViewProps) => {
  const answered = answeredCount(round)
  const complete = isComplete(round)
  const open = round.status === "open"

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">
          Round {round.index}
        </span>
        <span aria-hidden>·</span>
        <span>
          {answered}/{round.questions.length} answered
        </span>
        {open ? null : (
          <Badge className="ml-auto bg-ok/15 text-ok" variant="secondary">
            sent to Claude
          </Badge>
        )}
      </div>

      {round.intro === undefined ? null : (
        <div className="rounded-xl border bg-secondary px-4 py-3 text-sm">
          <Md text={round.intro} />
        </div>
      )}

      <div className="space-y-2">
        {round.questions.map((question, i) => (
          <QuestionCard
            active={open && activeQuestionId === question.id}
            answer={round.answers[question.id]}
            asides={asides.filter((a) => a.questionId === question.id)}
            highlighted={panelQuestionId === question.id}
            index={i + 1}
            key={question.id}
            onActivate={() => {
              onActivate(question.id)
            }}
            onAnswer={(answer) => {
              onAnswer(question.id, answer)
            }}
            onAside={(kind) => {
              onAside(question.id, kind)
            }}
            onOpenPanel={() => {
              onOpenPanel(question.id)
            }}
            onPick={(picked) => {
              onPick(question.id, picked)
            }}
            pick={activeQuestionId === question.id ? pick : undefined}
            question={question}
            roundOpen={open}
            unlocked={canAnswer(round, question.id)}
          />
        ))}
      </div>

      {open ? (
        <div className="flex items-center justify-end gap-3 pt-1">
          {complete ? null : (
            <span className="text-xs text-muted-foreground">
              Answer every question, then send the round.
            </span>
          )}
          <Button disabled={!complete} onClick={onSubmit} size="lg">
            Send answers to Claude
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      ) : null}
    </section>
  )
}
