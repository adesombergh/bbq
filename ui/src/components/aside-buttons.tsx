import type { Aside, AsideKind } from "@shared/types"

import { ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { isPending } from "@/lib/derive"
import { cn } from "@/lib/utils"

export const ASIDE_LABELS: Record<AsideKind, string> = {
  eli5: "ELI5",
  "show-me": "Show me",
  "wait-what": "Wait, what?",
}

const ASIDE_HINTS: Record<AsideKind, string> = {
  eli5: "Explain like I'm five",
  "show-me": "Draw it: a visual of the options",
  "wait-what": "Re-pitch this question in plain words",
}

const ORDER: AsideKind[] = ["wait-what", "show-me", "eli5"]

interface AsideButtonsProps {
  asides: Aside[]
  onRequest: (kind: AsideKind) => void
  onOpenPanel: () => void
}

/** The three aside triggers. A resolved aside re-opens the panel; anything else asks Claude. */
export const AsideButtons = ({
  asides,
  onRequest,
  onOpenPanel,
}: AsideButtonsProps) => (
  <>
    {ORDER.map((kind) => {
      const pending = asides.some((a) => a.kind === kind && isPending(a))
      const done = asides.some(
        (a) => a.kind === kind && a.status === "resolved"
      )
      const reopen = done && !pending
      return (
        <Tooltip key={kind}>
          <TooltipTrigger
            render={
              <Button
                className={cn(
                  pending && "animate-pulse border-info/60 text-info",
                  reopen && "border-info/40 text-info hover:bg-info/10"
                )}
                onClick={() => {
                  if (reopen) {
                    onOpenPanel()
                  } else {
                    onRequest(kind)
                  }
                }}
                size="sm"
                variant="outline"
              >
                {ASIDE_LABELS[kind]}
                {reopen ? <ExternalLink data-icon="inline-end" /> : null}
              </Button>
            }
          />
          <TooltipContent>{ASIDE_HINTS[kind]}</TooltipContent>
        </Tooltip>
      )
    })}
  </>
)
