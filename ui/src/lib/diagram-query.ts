import type { ResolvedTheme } from "@/lib/theme"

import { queryOptions } from "@tanstack/react-query"

/**
 * Source text -> SVG string. Mermaid is the largest dependency in the build by
 * a wide margin, so it is behind a dynamic import and only ever fetched when an
 * aside actually contains a diagram.
 *
 * The theme is part of the key because it is part of the render: the SVG is
 * produced once and then handed to the sandboxed frame, which cannot recolour
 * it afterwards. See docs/adr/0014-diagrams-render-in-the-frame.md.
 */
export const diagramKey = (source: string, theme: ResolvedTheme) =>
  ["diagram", theme, source] as const

let renderCount = 0

const renderDiagram = async (
  source: string,
  theme: ResolvedTheme
): Promise<string> => {
  const { default: mermaid } = await import("mermaid")
  mermaid.initialize({
    // Labels as SVG text, not foreignObject: the frame gets pure SVG.
    flowchart: { htmlLabels: false },
    securityLevel: "strict",
    startOnLoad: false,
    theme: theme === "dark" ? "dark" : "default",
  })
  renderCount += 1
  const { svg } = await mermaid.render(`diagram-${renderCount}`, source)
  return svg
}

export const diagramQueryOptions = (source: string, theme: ResolvedTheme) =>
  queryOptions({
    gcTime: Number.POSITIVE_INFINITY,
    queryFn: async () => await renderDiagram(source, theme),
    queryKey: diagramKey(source, theme),
    // A syntax error is not transient; the caller falls back to the source.
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  })
