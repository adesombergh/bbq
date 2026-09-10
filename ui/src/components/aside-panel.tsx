import type { Aside, AsideKind, Question, Round } from "@shared/types"

import { ASIDE_KINDS } from "@shared/types"
import { Plus, X } from "lucide-react"

import { ASIDE_LABELS } from "@/components/aside-buttons"
import { HtmlFrame } from "@/components/html-frame"
import { Md } from "@/components/md"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { asidesByKind, isPending } from "@/lib/derive"

interface AsidePanelProps {
  question: Question
  round: Round
  asides: Aside[]
  tab: AsideKind | undefined
  onTabChange: (kind: AsideKind) => void
  onClose: () => void
  onRequest: (kind: AsideKind) => void
}

const AsideBody = ({ aside }: { aside: Aside }) => {
  if (isPending(aside)) {
    return (
      <div className="flex items-center justify-center gap-3 py-8 text-sm text-muted-foreground">
        <span className="inline-block size-2.5 animate-pulse rounded-full bg-info" />
        {aside.status === "requested"
          ? "Sent to Claude, waiting for it to pick this up…"
          : "Claude is working on it…"}
      </div>
    )
  }
  if (aside.status === "failed") {
    return (
      <p className="text-sm text-destructive">
        Claude could not produce this: {aside.error}
      </p>
    )
  }
  if (aside.format === "html") {
    return <HtmlFrame html={aside.content ?? ""} />
  }
  return <Md className="text-[15px]" text={aside.content ?? ""} />
}

const isAsideKind = (value: string): value is AsideKind =>
  ASIDE_KINDS.some((kind) => kind === value)

export const AsidePanel = ({
  question,
  round,
  asides,
  tab,
  onTabChange,
  onClose,
  onRequest,
}: AsidePanelProps) => {
  const byKind = asidesByKind(asides)
  const current = tab === undefined ? undefined : byKind.get(tab)
  const position = round.questions.findIndex((q) => q.id === question.id) + 1

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape closes the panel; the close button stays the primary control
    <aside
      className="flex h-full flex-col bg-secondary"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose()
        }
      }}
    >
      <div className="flex items-start gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] tracking-widest text-info uppercase">
            Context · Round {round.index} · Q{position}
          </div>
          <div className="truncate font-semibold">{question.title}</div>
        </div>
        <Button
          aria-label="Close panel (Esc)"
          onClick={onClose}
          size="icon-sm"
          variant="ghost"
        >
          <X />
        </Button>
      </div>

      <Tabs
        className="min-h-0 flex-1 gap-0"
        onValueChange={(value) => {
          if (typeof value === "string" && isAsideKind(value)) {
            if (byKind.has(value)) {
              onTabChange(value)
            } else {
              onRequest(value)
            }
          }
        }}
        value={tab ?? null}
      >
        <TabsList className="mx-4 mt-3 w-auto" variant="line">
          {ASIDE_KINDS.map((kind) => {
            const aside = byKind.get(kind)
            return (
              <TabsTrigger key={kind} value={kind}>
                {ASIDE_LABELS[kind]}
                {aside && isPending(aside) ? (
                  <span className="inline-block size-1.5 animate-pulse rounded-full bg-info" />
                ) : null}
                {aside ? null : <Plus className="size-3 opacity-60" />}
              </TabsTrigger>
            )
          })}
        </TabsList>
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-4 py-4">
            {current ? (
              <AsideBody aside={current} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Pick a tab above to ask Claude for an aside about this question.
              </p>
            )}
          </div>
        </ScrollArea>
      </Tabs>
    </aside>
  )
}
