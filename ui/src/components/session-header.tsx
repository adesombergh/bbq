import type { ConnectionStatus } from "@/lib/session-socket"
import type { Session } from "@shared/types"

import { Flame, Ham } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  closed: "reconnecting",
  connecting: "connecting",
  open: "live",
}

const STATUS_DOT: Record<ConnectionStatus, string> = {
  closed: "bg-destructive",
  connecting: "animate-pulse bg-primary",
  open: "bg-ok",
}

interface SessionHeaderProps {
  session: Session
  status: ConnectionStatus
}

export const SessionHeader = ({ session, status }: SessionHeaderProps) => {
  const rounds = session.rounds.length
  return (
    <header className="flex shrink-0 items-center gap-3 border-b bg-secondary px-4 py-3">
      <span
        aria-hidden
        className="flex shrink-0 items-center gap-0.5 text-primary"
      >
        <Flame className="size-5" />
        <Ham className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-heading font-semibold">{session.title}</h1>
        <p className="text-xs text-muted-foreground">
          Grilling session · {rounds} {rounds === 1 ? "round" : "rounds"} ·{" "}
          {session.status}
        </p>
      </div>
      <Badge className="gap-1.5 text-muted-foreground" variant="outline">
        <span
          aria-hidden
          className={cn("size-2 rounded-full", STATUS_DOT[status])}
        />
        {STATUS_LABEL[status]}
      </Badge>
      <ThemeToggle />
    </header>
  )
}
