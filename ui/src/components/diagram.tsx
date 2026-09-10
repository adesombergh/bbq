import { useSyncExternalStore } from "react"
import { useQuery } from "@tanstack/react-query"

import { HtmlFrame } from "@/components/html-frame"
import { diagramQueryOptions } from "@/lib/diagram-query"
import { getResolvedTheme, subscribeTheme } from "@/lib/theme"

/** What the block looked like before mermaid existed, and what it falls back to. */
const Source = ({ source }: { source: string }) => (
  <pre className="tm-code" data-lang="mermaid">
    <code className="language-mermaid">{source}</code>
  </pre>
)

/**
 * A ```mermaid block from an aside. The SVG mermaid produces goes through the
 * same sandboxed frame as every other piece of markup Claude authored; a
 * diagram that does not parse degrades to the source, so the feature can never
 * make an aside worse than it would have been.
 */
export const Diagram = ({ source }: { source: string }) => {
  const theme = useSyncExternalStore(subscribeTheme, getResolvedTheme)
  const { data, isError } = useQuery(diagramQueryOptions(source, theme))

  if (isError) {
    return <Source source={source} />
  }
  if (data === undefined) {
    return (
      <p className="py-4 text-sm text-muted-foreground">Drawing the diagram…</p>
    )
  }
  return <HtmlFrame html={data} />
}
