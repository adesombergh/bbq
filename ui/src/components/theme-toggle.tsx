import type { Theme } from "@/lib/theme"

import { useSyncExternalStore } from "react"

import { Monitor, Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getTheme, nextTheme, setTheme, subscribeTheme } from "@/lib/theme"

const ICONS: Record<Theme, typeof Monitor> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
}

const LABELS: Record<Theme, string> = {
  dark: "dark",
  light: "light",
  system: "system",
}

/** Cycles system → light → dark. The theme itself lives in lib/theme.ts. */
export const ThemeToggle = () => {
  const theme = useSyncExternalStore(subscribeTheme, getTheme)
  const next = nextTheme(theme)
  const Icon = ICONS[theme]
  const hint = `Switch to ${LABELS[next]} theme`
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={hint}
            onClick={() => {
              setTheme(next)
            }}
            size="icon-sm"
            variant="ghost"
          >
            <Icon aria-hidden />
          </Button>
        }
      />
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  )
}
