import type { Answer, Aside, AsideKind, Question } from "@shared/types"
import type { ReactNode } from "react"

import { ArrowRight, Check, ExternalLink } from "lucide-react"

import { AsideButtons } from "@/components/aside-buttons"
import { ManualAnswer } from "@/components/manual-answer"
import { Md } from "@/components/md"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { RECOMMENDED_PICK } from "@/lib/derive"
import { cn } from "@/lib/utils"

interface QuestionCardProps {
  index: number
  question: Question
  answer: Answer | undefined
  pick: string | undefined
  active: boolean
  unlocked: boolean
  roundOpen: boolean
  highlighted: boolean
  asides: Aside[]
  onActivate: () => void
  onPick: (pick: string) => void
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

/**
 * The second press. It fades in over the same 250ms as the collapse and the
 * `.pick-confirm` rule keeps it inert while it does, so the second click of a
 * double-click on an option cannot reach it
 * (docs/adr/0017-answering-takes-two-presses.md).
 */
const ConfirmPick = ({
  label,
  onConfirm,
}: {
  label: string
  onConfirm: () => void
}) => (
  <Button
    className="pick-confirm"
    onClick={(event) => {
      // The option row is itself a click target: without this the row would
      // re-pick the option after we have already answered it.
      event.stopPropagation()
      onConfirm()
    }}
    size="sm"
  >
    <Check data-icon="inline-start" />
    {label}
  </Button>
)

const isActivationKey = (key: string): boolean => key === "Enter" || key === " "

/**
 * One option. It cannot be a `<button>` any more, because the confirm button
 * lives inside it; it keeps the semantics the old button claimed — a pressable
 * thing with `aria-pressed` — and owes Enter and Space by hand.
 */
const OptionRow = ({
  question,
  option,
  answer,
  pick,
  onPick,
  onAnswer,
}: {
  option: Question["options"][number]
} & Pick<
  QuestionCardProps,
  "question" | "answer" | "pick" | "onPick" | "onAnswer"
>) => {
  const chosen = answer?.optionId === option.id
  const picked = pick === option.id
  const recommended = question.recommendedOptionId === option.id
  const confirm = (): void => {
    onAnswer({ kind: "option", optionId: option.id, text: option.label })
  }
  return (
    <div
      aria-pressed={chosen}
      className={cn(
        "rounded-lg border bg-secondary px-3 py-2.5 text-left transition-colors select-none hover:border-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        picked && "border-primary hover:border-primary",
        chosen && "border-ok bg-ok/10 hover:border-ok"
      )}
      onClick={() => {
        onPick(option.id)
      }}
      onKeyDown={(event) => {
        if (isActivationKey(event.key)) {
          event.preventDefault()
          onPick(option.id)
        }
      }}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a `<button>` cannot contain the confirm button this row wraps; ADR 0017 records why the row stays a pressable div rather than a radio group.
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md font-mono text-xs",
            chosen
              ? "bg-ok text-background"
              : "bg-accent text-muted-foreground",
            picked && !chosen && "bg-primary text-primary-foreground"
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
          {picked ? (
            <div className="mt-2.5">
              <ConfirmPick label="Confirm choice" onConfirm={confirm} />
            </div>
          ) : null}
        </div>
        {chosen ? <Check className="size-4 text-ok" /> : null}
      </div>
    </div>
  )
}

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

const QuestionBody = (props: QuestionCardProps) => {
  const { question, answer, pick, asides, roundOpen } = props
  const { onPick, onAnswer, onAside, onOpenPanel } = props
  const hasOptions = question.options.length > 0
  const wentWithRecommendation = answer?.kind === "recommended"
  const recommendationPicked = pick === RECOMMENDED_PICK
  return (
    <>
      <Section label={hasOptions ? "Options" : "Open question"}>
        {hasOptions ? (
          <div className="grid gap-2">
            {question.options.map((option) => (
              <OptionRow
                answer={answer}
                key={option.id}
                onAnswer={onAnswer}
                onPick={onPick}
                option={option}
                pick={pick}
                question={question}
              />
            ))}
          </div>
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
            className={cn(
              wentWithRecommendation && "bg-ok hover:bg-ok/90",
              recommendationPicked && "ring-3 ring-ring/50"
            )}
            onClick={() => {
              onPick(RECOMMENDED_PICK)
            }}
          >
            {wentWithRecommendation ? <Check data-icon="inline-start" /> : null}
            {wentWithRecommendation
              ? "Going with recommendation"
              : "Go with recommendation"}
          </Button>
          {recommendationPicked ? (
            <ConfirmPick
              label="Confirm recommendation"
              onConfirm={() => {
                onAnswer({
                  kind: "recommended",
                  text: question.recommendation,
                })
              }}
            />
          ) : null}
          <span className="flex-1" />
          <AsideButtons
            asides={asides}
            onOpenPanel={onOpenPanel}
            onRequest={onAside}
          />
        </div>
      </Section>

      <AnswerFooter answer={answer} roundOpen={roundOpen} />
    </>
  )
}

const collapsedHint = (props: QuestionCardProps): string => {
  if (!props.unlocked) {
    return "Locked until the previous question is answered"
  }
  return props.roundOpen ? "Up next — click to answer" : ""
}

const summary = (props: QuestionCardProps): string => {
  const { answer } = props
  if (answer === undefined) {
    return collapsedHint(props)
  }
  return `${answer.kind === "recommended" ? "Recommendation: " : ""}${answer.text}`
}

/**
 * A question you have not read starts at its title: the card scrolls its own
 * top into view the moment it becomes the active one. React 19 calls this ref
 * when it is attached, which is exactly when `active` flips to true.
 */
const scrollTopIntoView = (node: HTMLDivElement | null): void => {
  node?.scrollIntoView({ behavior: "smooth", block: "start" })
}

const badgeTone = (props: QuestionCardProps): string => {
  if (props.answer) {
    return "bg-ok/20 text-ok"
  }
  return props.unlocked
    ? "bg-primary/20 text-primary"
    : "bg-accent text-muted-foreground"
}

/**
 * The header, always mounted: the trigger that expands the card when it is
 * collapsed, and the card's title once it is open. It only ever opens — a
 * session with no expanded question has nowhere to put `?q=`.
 */
const QuestionHeader = (props: QuestionCardProps) => {
  const { index, question, answer, active, unlocked, roundOpen, asides } = props
  const clickable = roundOpen && unlocked && !active
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <CollapsibleTrigger
        className={cn(
          "flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none",
          clickable ? "cursor-pointer" : "cursor-default"
        )}
        disabled={!clickable}
      >
        <span
          className={cn(
            "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md font-mono text-xs",
            badgeTone(props)
          )}
        >
          {answer && !active ? <Check className="size-3.5" /> : index}
        </span>
        <span className="min-w-0 flex-1">
          {active ? (
            <span className="mb-1 block text-[11px] tracking-widest text-primary uppercase">
              Question {index}
            </span>
          ) : null}
          <span
            className={cn(
              "block font-medium",
              active && "font-heading text-lg leading-snug font-semibold",
              !unlocked && !answer && "text-muted-foreground"
            )}
          >
            {question.title}
          </span>
          {active ? null : (
            <span className="block truncate text-sm text-muted-foreground">
              {summary(props)}
            </span>
          )}
        </span>
      </CollapsibleTrigger>
      {asides.length > 0 && !active ? (
        <Button
          className="shrink-0 text-info"
          onClick={props.onOpenPanel}
          size="xs"
          variant="ghost"
        >
          {asides.length} {asides.length > 1 ? "asides" : "aside"}
          <ExternalLink data-icon="inline-end" />
        </Button>
      ) : null}
      {answer && roundOpen && !active ? (
        <span className="shrink-0 text-xs text-muted-foreground">change</span>
      ) : null}
    </div>
  )
}

/**
 * One card per question, always mounted: the header is always there and the
 * body is a collapsible panel, so answering collapses this question while the
 * next one expands (~250ms, `.question-panel` in styles.css).
 */
export const QuestionCard = (props: QuestionCardProps) => {
  const { question, active, roundOpen, highlighted, onActivate } = props
  return (
    <Card
      className={cn(
        "gap-0 py-0 ring-primary/60",
        active ? "shadow-lg shadow-black/30" : "bg-secondary/50",
        active && roundOpen && "bg-card",
        highlighted && "ring-info/60"
      )}
      ref={active ? scrollTopIntoView : undefined}
    >
      <Collapsible
        onOpenChange={(open) => {
          if (open) {
            onActivate()
          }
        }}
        open={active}
      >
        <QuestionHeader {...props} />
        <CollapsibleContent className="question-panel">
          <div className="border-t">
            <div className="border-b px-4 py-4">
              <Md className="text-[15px]" text={question.body} />
            </div>
            <QuestionBody {...props} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
