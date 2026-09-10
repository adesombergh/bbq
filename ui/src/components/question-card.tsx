import type { Answer, Aside, AsideKind, Question } from "@shared/types"
import type { ReactNode } from "react"

import { ArrowRight, Check, ExternalLink } from "lucide-react"

import { AsideButtons } from "@/components/aside-buttons"
import { ManualAnswer } from "@/components/manual-answer"
import { Md } from "@/components/md"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface QuestionCardProps {
  index: number
  question: Question
  answer: Answer | undefined
  active: boolean
  unlocked: boolean
  roundOpen: boolean
  highlighted: boolean
  asides: Aside[]
  onActivate: () => void
  onAnswer: (answer: Omit<Answer, "answeredAt">) => void
  onAside: (kind: AsideKind) => void
  onOpenPanel: () => void
}

interface SectionProps {
  label: string
  tone?: "accent"
  last?: boolean
  children: ReactNode
}

const Section = ({ label, tone, last = false, children }: SectionProps) => (
  <div className={cn("px-4 py-4", !last && "border-b")}>
    <div
      className={cn(
        "mb-2 text-[11px] tracking-widest uppercase",
        tone === "accent" ? "text-primary" : "text-muted-foreground"
      )}
    >
      {label}
    </div>
    {children}
  </div>
)

const OptionList = ({
  question,
  answer,
  onAnswer,
}: Pick<QuestionCardProps, "question" | "answer" | "onAnswer">) => (
  <div className="grid gap-2">
    {question.options.map((option) => {
      const chosen = answer?.optionId === option.id
      const recommended = question.recommendedOptionId === option.id
      return (
        <button
          aria-pressed={chosen}
          className={cn(
            "rounded-lg border bg-secondary px-3 py-2.5 text-left transition-colors hover:border-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            chosen && "border-ok bg-ok/10 hover:border-ok"
          )}
          key={option.id}
          onClick={() => {
            onAnswer({
              kind: "option",
              optionId: option.id,
              text: option.label,
            })
          }}
          type="button"
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md font-mono text-xs",
                chosen
                  ? "bg-ok text-background"
                  : "bg-accent text-muted-foreground"
              )}
            >
              {option.id}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-medium">
                {option.label}
                {recommended ? (
                  <Badge className="text-primary" variant="outline">
                    recommended
                  </Badge>
                ) : null}
              </div>
              {option.description === undefined ? null : (
                <Md
                  className="mt-0.5 text-sm text-muted-foreground"
                  text={option.description}
                />
              )}
            </div>
            {chosen ? <Check className="size-4 text-ok" /> : null}
          </div>
        </button>
      )
    })}
  </div>
)

const AnswerFooter = ({
  answer,
  roundOpen,
}: Pick<QuestionCardProps, "answer" | "roundOpen">) =>
  answer === undefined ? null : (
    <div className="flex items-center gap-2 border-t bg-ok/5 px-4 py-2.5 text-sm">
      <Check className="size-4 text-ok" />
      <span className="text-muted-foreground">Your answer:</span>
      <span className="truncate font-medium">{answer.text}</span>
      {roundOpen ? null : (
        <span className="ml-auto text-xs text-muted-foreground">sent</span>
      )}
    </div>
  )

const ActiveCard = (props: QuestionCardProps) => {
  const { index, question, answer, highlighted, asides, roundOpen } = props
  const { onAnswer, onAside, onOpenPanel } = props
  const hasOptions = question.options.length > 0
  const wentWithRecommendation = answer?.kind === "recommended"
  return (
    <Card
      className={cn(
        "gap-0 py-0 shadow-lg shadow-black/30 ring-primary/60",
        highlighted && "ring-info/60"
      )}
    >
      <Section label={`Question ${index}`} tone="accent">
        <h2 className="font-heading text-lg leading-snug font-semibold">
          {question.title}
        </h2>
        <Md className="mt-2 text-[15px]" text={question.body} />
      </Section>

      <Section label={hasOptions ? "Options" : "Open question"}>
        {hasOptions ? (
          <OptionList answer={answer} onAnswer={onAnswer} question={question} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No fixed options. Go with the recommendation or write your own
            answer.
          </p>
        )}
        <ManualAnswer
          answer={answer}
          key={answer?.answeredAt ?? "unanswered"}
          onAnswer={onAnswer}
        />
      </Section>

      <Section label="Claude recommends" last tone="accent">
        <div className="flex gap-3">
          <ArrowRight className="mt-1 size-4 shrink-0 text-primary" />
          <Md className="flex-1 text-[15px]" text={question.recommendation} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            className={cn(wentWithRecommendation && "bg-ok hover:bg-ok/90")}
            onClick={() => {
              onAnswer({ kind: "recommended", text: question.recommendation })
            }}
          >
            {wentWithRecommendation ? <Check data-icon="inline-start" /> : null}
            {wentWithRecommendation
              ? "Going with recommendation"
              : "Go with recommendation"}
          </Button>
          <span className="flex-1" />
          <AsideButtons
            asides={asides}
            onOpenPanel={onOpenPanel}
            onRequest={onAside}
          />
        </div>
      </Section>

      <AnswerFooter answer={answer} roundOpen={roundOpen} />
    </Card>
  )
}

const collapsedHint = (props: QuestionCardProps): string => {
  if (!props.unlocked) {
    return "Locked until the previous question is answered"
  }
  return props.roundOpen ? "Up next — click to answer" : ""
}

const CollapsedCard = (props: QuestionCardProps) => {
  const { index, question, answer, unlocked, roundOpen, highlighted, asides } =
    props
  const { onActivate, onOpenPanel } = props
  const clickable = roundOpen && unlocked
  const badgeTone = (): string => {
    if (answer) {
      return "bg-ok/20 text-ok"
    }
    return unlocked
      ? "bg-primary/20 text-primary"
      : "bg-accent text-muted-foreground"
  }
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3",
        highlighted && "border-info/60",
        clickable ? "bg-secondary" : "bg-secondary/50"
      )}
    >
      <button
        className={cn(
          "flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none",
          clickable ? "cursor-pointer" : "cursor-default"
        )}
        disabled={!clickable}
        onClick={onActivate}
        type="button"
      >
        <span
          className={cn(
            "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md font-mono text-xs",
            badgeTone()
          )}
        >
          {answer ? <Check className="size-3.5" /> : index}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block font-medium",
              !unlocked && !answer && "text-muted-foreground"
            )}
          >
            {question.title}
          </span>
          <span className="block truncate text-sm text-muted-foreground">
            {answer
              ? `${answer.kind === "recommended" ? "Recommendation: " : ""}${answer.text}`
              : collapsedHint(props)}
          </span>
        </span>
      </button>
      {asides.length > 0 ? (
        <Button
          className="shrink-0 text-info"
          onClick={onOpenPanel}
          size="xs"
          variant="ghost"
        >
          {asides.length} {asides.length > 1 ? "asides" : "aside"}
          <ExternalLink data-icon="inline-end" />
        </Button>
      ) : null}
      {answer && roundOpen ? (
        <span className="shrink-0 text-xs text-muted-foreground">change</span>
      ) : null}
    </div>
  )
}

export const QuestionCard = (props: QuestionCardProps) =>
  props.active ? <ActiveCard {...props} /> : <CollapsedCard {...props} />
