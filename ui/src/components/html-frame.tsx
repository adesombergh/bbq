import type { ResolvedTheme } from "@/lib/theme"

import { useState, useSyncExternalStore } from "react"

import { getResolvedTheme, subscribeTheme } from "@/lib/theme"

/** Sandboxed frame for Claude-produced HTML (SVG diagrams etc.). No scripts run. */
const DEFAULT_HEIGHT = 400
const MAX_HEIGHT = 4000
const PADDING = 16

/**
 * The frame is its own document, so the app's CSS variables do not reach it:
 * these mirror the two palettes in styles.css and follow the theme switcher.
 */
const PALETTES: Record<
  ResolvedTheme,
  { foreground: string; border: string; link: string }
> = {
  dark: { border: "#2a2f3a", foreground: "#e6e8ee", link: "#60a5fa" },
  light: { border: "#d9dde4", foreground: "#16181d", link: "#2563eb" },
}

const frameDocument = (html: string, theme: ResolvedTheme): string => {
  const palette = PALETTES[theme]
  return `<!doctype html><meta charset="utf-8"><style>
html{color-scheme:${theme}}html,body{margin:0;background:transparent;color:${palette.foreground};font:15px/1.5 "Geist Variable",system-ui,sans-serif}
body{padding:4px} img,svg{max-width:100%} table{border-collapse:collapse} td,th{border:1px solid ${palette.border};padding:.3em .6em}
a{color:${palette.link}}
</style><body>${html}</body>`
}

export const HtmlFrame = ({ html }: { html: string }) => {
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const theme = useSyncExternalStore(subscribeTheme, getResolvedTheme)
  return (
    <iframe
      className="min-h-[400px] w-full rounded-lg border bg-background"
      onLoad={(event) => {
        // allow-same-origin (without scripts) lets us read the height to auto-size the frame.
        const measured = event.currentTarget.contentDocument?.body.scrollHeight
        if (measured !== undefined && measured > 0) {
          setHeight(Math.min(MAX_HEIGHT, measured + PADDING))
        }
      }}
      sandbox="allow-same-origin"
      srcDoc={frameDocument(html, theme)}
      style={{ height }}
      title="visual"
    />
  )
}
