import { useState } from "react"

/** Sandboxed frame for Claude-produced HTML (SVG diagrams etc.). No scripts run. */
const DEFAULT_HEIGHT = 400
const MAX_HEIGHT = 4000
const PADDING = 16

const frameDocument = (html: string): string =>
  `<!doctype html><meta charset="utf-8"><style>
html{color-scheme:dark}html,body{margin:0;background:transparent;color:#e6e8ee;font:15px/1.5 "Geist Variable",system-ui,sans-serif}
body{padding:4px} img,svg{max-width:100%} table{border-collapse:collapse} td,th{border:1px solid #2a2f3a;padding:.3em .6em}
a{color:#60a5fa}
</style><body>${html}</body>`

export const HtmlFrame = ({ html }: { html: string }) => {
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
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
      srcDoc={frameDocument(html)}
      style={{ height }}
      title="visual"
    />
  )
}
